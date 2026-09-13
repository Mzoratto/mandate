precision highp float;
uniform vec3 uPrimary;
uniform float uColorize;
varying float vCoverage;
varying vec3 vReferenceColor;
varying float vPulse;
void main() {
  float d=length(gl_PointCoord-.5);
  if(d>.5)discard;
  vec3 color=mix(vReferenceColor*vec3(.8,.9,.95),vec3(vReferenceColor.b)*uPrimary,uColorize)*1.5*vPulse;
  float alpha=1.0-smoothstep(.22,.5,d);
  gl_FragColor=vec4(color,alpha*vCoverage);
}
