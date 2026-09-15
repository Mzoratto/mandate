precision highp float;
varying vec3 vSurfaceNormal;
varying vec3 vSurfacePosition;
void main() {
  vSurfaceNormal=normalize(normalMatrix*normal);
  vSurfacePosition=position;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}
