attribute vec3 position;
attribute float life;
attribute vec3 color;

uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;

varying float vLife;
varying vec3 vColor;
varying float vWorldDistance;

void main() {
  vLife = life;
  vColor = color;
  vWorldDistance = smoothstep(0.0, 0.1, length(position));

  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_PointSize = 10.0 * (vWorldDistance * (1.0 - 0.6) + 0.6);
}