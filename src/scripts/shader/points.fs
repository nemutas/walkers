precision mediump float;

varying float vLife;
varying vec3 vColor;
varying float vWorldDistance;

void main() {
  if (0.5 < distance(gl_PointCoord, vec2(0.5))) discard;

  gl_FragColor = vec4(vColor * 0.8 * vLife * vWorldDistance, 1);
}