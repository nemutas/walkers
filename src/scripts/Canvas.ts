import * as THREE from 'three'
import { three } from './core/Three'
import fragmentShader from './shader/points.fs'
import vertexShader from './shader/points.vs'
import { gui } from './Gui'

export class Canvas {
  private points: THREE.Points<THREE.BufferGeometry, THREE.RawShaderMaterial>
  private lines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>
  private field: THREE.Group

  private pointsParams: { life: number; direction: THREE.Vector2; color: THREE.Color }[] = []

  private raycaster = new THREE.Raycaster()
  private rayDirection = new THREE.Vector3(0, 0, -1)
  private originPosition = new THREE.Vector3()

  constructor(canvas: HTMLCanvasElement) {
    this.init(canvas)
    this.points = this.createPoints()
    this.lines = this.createLines(this.points)
    this.field = this.createField()
    this.setGui()
    three.animation(this.anime)
  }

  private init(canvas: HTMLCanvasElement) {
    three.setup(canvas)
    three.scene.background = new THREE.Color('#000')
  }

  private setGui() {
    gui.add(this.field, 'visible').name('field')
  }

  private rand() {
    return Math.random() * 2 - 1
  }

  private createPoints() {
    const geometry = new THREE.BufferGeometry()

    const pointsCount = 80

    const positions: number[] = []
    const lifeTimes: number[] = []
    const colors: number[] = []

    const colorSet = ['#00eaff', '#ffc921', '#ff00d9']

    for (let i = 0; i < pointsCount; i++) {
      positions.push(0, 0, 0)

      const life = 1 + i / pointsCount
      lifeTimes.push(life)
      const color = new THREE.Color(colorSet[i % colorSet.length])
      colors.push(color.r, color.g, color.b)
      this.pointsParams.push({ life, direction: new THREE.Vector2(this.rand(), this.rand()).normalize(), color })
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('life', new THREE.Float32BufferAttribute(lifeTimes, 1).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

    const material = new THREE.RawShaderMaterial({
      uniforms: {},
      vertexShader,
      fragmentShader,
    })
    const mesh = new THREE.Points(geometry, material)
    three.scene.add(mesh)

    return mesh
  }

  private createLines(points: THREE.Points) {
    const pointsCount = points.geometry.attributes.position.count

    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(pointsCount * 3 * 2 * 4) // pointCount * axes * lineEdge * lineCount
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
    const colors: number[] = []
    for (let i = 0; i < pointsCount * 2 * 4; i++) {
      colors.push(0, 0, 0)
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage))

    const material = new THREE.LineBasicMaterial({ vertexColors: true })
    const mesh = new THREE.LineSegments(geometry, material)
    three.scene.add(mesh)

    return mesh
  }

  private createField() {
    const field = new THREE.Group()
    three.scene.add(field)
    field.visible = false

    const geometry = new THREE.PlaneGeometry(0.05, 0.05)
    const material = new THREE.MeshBasicMaterial({ color: '#fff', wireframe: true, transparent: true, opacity: 0.03 })

    const { width, height } = geometry.parameters

    const amount = { x: 31, y: 17 }
    const offset = { x: (width * (amount.x - 1)) / 2, y: (height * (amount.y - 1)) / 2 }

    for (let x = 0; x < amount.x; x++) {
      for (let y = 0; y < amount.y; y++) {
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(width * x - offset.x, height * y - offset.y, -0.01)
        mesh.updateMatrixWorld()
        field.add(mesh)
      }
    }

    return field
  }

  private update() {
    const position = this.points.geometry.attributes.position
    const pointCoord = position.array

    let ix, iy, iz
    for (let i = 0; i < position.count; i++) {
      ix = i * 3 + 0
      iy = i * 3 + 1
      iz = i * 3 + 2
      this.pointsParams[i].life -= three.time.delta * 0.15

      if (this.pointsParams[i].life <= 1) {
        pointCoord[ix] += 0.0015 * this.pointsParams[i].direction.x
        pointCoord[iy] += 0.0015 * this.pointsParams[i].direction.y
      }
      if (this.pointsParams[i].life < 0) {
        this.pointsParams[i].life = 1
        this.pointsParams[i].direction.set(this.rand(), this.rand()).normalize()
        pointCoord[ix] = 0
        pointCoord[iy] = 0
      }

      this.points.geometry.attributes.life.array[i] = this.pointsParams[i].life

      this.updateLines([pointCoord[ix], pointCoord[iy], pointCoord[iz]], i)
    }

    this.points.geometry.attributes.position.needsUpdate = true
    this.points.geometry.attributes.life.needsUpdate = true
    this.lines.geometry.attributes.position.needsUpdate = true
    this.lines.geometry.attributes.color.needsUpdate = true
  }

  private updateLines(pointCoord: [number, number, number], pointIndex: number) {
    this.originPosition.set(pointCoord[0], pointCoord[1], pointCoord[2])
    this.raycaster.set(this.originPosition, this.rayDirection)
    const intersects = this.raycaster.intersectObjects(this.field.children, false)

    if (0 < intersects.length) {
      let worldDistance = this.originPosition.length()
      worldDistance = THREE.MathUtils.smoothstep(worldDistance, 0.03, 0.15)

      const plane = intersects[0].object as THREE.Mesh<THREE.PlaneGeometry, THREE.Material>
      const { x, y, z } = plane.position
      const { width, height } = plane.geometry.parameters
      const diagnal = Math.hypot(width, height)

      const linePos = this.lines.geometry.attributes.position.array

      let i = 0
      let x1, y1, z1, x2, y2, z2
      const distances: number[] = []
      for (let dx of [-1, 1]) {
        for (let dy of [-1, 1]) {
          x1 = pointCoord[0]
          y1 = pointCoord[1]
          z1 = pointCoord[2]
          x2 = x + dx * width * 0.5
          y2 = y + dy * height * 0.5
          z2 = z

          linePos[pointIndex * 24 + i * 6 + 0] = x1
          linePos[pointIndex * 24 + i * 6 + 1] = y1
          linePos[pointIndex * 24 + i * 6 + 2] = z1
          linePos[pointIndex * 24 + i * 6 + 3] = x2
          linePos[pointIndex * 24 + i * 6 + 4] = y2
          linePos[pointIndex * 24 + i * 6 + 5] = z2

          distances.push(Math.hypot(x1 - x2, y1 - y2, z1 - z2))

          i++
        }
      }

      const lineColor = this.lines.geometry.attributes.color.array
      const param = this.pointsParams[pointIndex]
      for (let i = 0; i < distances.length; i++) {
        let d = distances[i]
        d = 1 - d / diagnal
        d = d * d * d
        d *= param.life

        for (let j = 0; j < 2; j++) {
          lineColor[pointIndex * 24 + i * 6 + j * 3 + 0] = param.color.r * d * worldDistance
          lineColor[pointIndex * 24 + i * 6 + j * 3 + 1] = param.color.g * d * worldDistance
          lineColor[pointIndex * 24 + i * 6 + j * 3 + 2] = param.color.b * d * worldDistance
        }
      }
    }
  }

  private anime = () => {
    this.update()

    three.render()
  }

  dispose() {
    three.dispose()
  }
}
