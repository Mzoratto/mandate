precision highp float;
uniform vec3 uSurfaceColor;
varying vec3 vSurfaceNormal;
varying vec3 vSurfacePosition;
void main() {
  vec3 normal=normalize(vSurfaceNormal);
  float key=pow(max(0.0,dot(normal,normalize(vec3(0.0,0.24,0.94)))),1.55);
  float front=smoothstep(-0.04,0.52,normal.z);
  float depth=smoothstep(0.18,0.84,vSurfacePosition.z);
  float crown=1.0-0.74*smoothstep(0.4,0.98,vSurfacePosition.y);
  float shoulders=smoothstep(-1.58,-0.72,vSurfacePosition.y);
  float alpha=(0.018+0.13*key+0.065*depth)*front*crown*shoulders;
  gl_FragColor=vec4(uSurfaceColor*(0.3+1.15*key),alpha);
}
