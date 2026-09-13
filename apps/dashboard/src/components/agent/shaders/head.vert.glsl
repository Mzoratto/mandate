precision highp float;
uniform float uTime;
uniform float uAssembly;
uniform float uThinking;
uniform float uTurn;
attribute float aBack;
uniform float uJitter;
uniform float uDispersion;
uniform float uPulseSpeed;
uniform float uPixelRatio;
uniform float uViewportScale;
attribute float aCoverage;
varying float vCoverage;
varying float vPulse;
attribute vec3 aReferenceColor;
varying vec3 vReferenceColor;
attribute float aSeed;
attribute float aRegion;
attribute vec3 aRandomDirection;
attribute float aBaseSize;
// Three independent simplex fields produce coherent, bounded 3D drift.
vec3 flow(vec3 p,float t) {
  p=p*1.6+vec3(0.0,t*.15,0.0);
  return vec3(snoise(p),snoise(p+vec3(19.1,7.3,3.4)),snoise(p+vec3(4.7,31.2,12.8)));
}
void main() {
  vReferenceColor=aReferenceColor;
  vCoverage=aCoverage*mix(1.0,smoothstep(.06,.35,uTurn),aBack);
  vec3 viewNormal=normalize(normalMatrix*normal);
  vec3 viewDirection=normalize(-(modelViewMatrix*vec4(position,1.0)).xyz);
  vCoverage*=smoothstep(-.12,.08,dot(viewNormal,viewDirection));
  bool structure=aRegion<4.0;
  float mobility=structure ? .14 : 1.0+max(0.0,-position.y-1.0)*2.5;
  float wave=snoise(position*2.2+vec3(0.0,uTime*.22,0.0));
  vec3 p=position+normal*abs(wave)*uJitter*.35;
  p+=aRandomDirection*uDispersion*mobility*(.25+.75*aSeed)*(.7+.3*sin(uTime*1.8+aSeed*30.0));
  float dissolve=(1.0-smoothstep(-1.85,-.85,position.y));
  float release=dissolve*(.15+.85*aSeed);
  if(aRegion>4.5) {
    float age=fract(uTime*(.07+uDispersion*.3)+aSeed);
    float loose=step(.82,aSeed);
    vec3 drift=flow(position,uTime)*( .025+loose*.24+uDispersion*.8);
    p+=drift*release*age;
    p.y-=loose*release*age*.18;
    vCoverage*=mix(1.0,smoothstep(0.0,.12,age)*(1.0-smoothstep(.72,1.0,age)),loose);
  }
  // Each particle has a fixed scattered origin; staggered easing ends exactly on the approved face.
  float assembled=smoothstep(aSeed*.23,.72+aSeed*.28,uAssembly);
  float angle=aSeed*137.508;
  vec3 origin=vec3(sin(angle)*(1.5+aSeed*1.4), cos(angle*1.7)*2.1, sin(angle*.7)*1.5);
  vec3 arc=vec3(cos(angle+uAssembly*3.0),sin(angle+uAssembly*3.0),0.0)*sin(assembled*3.14159)*.3;
  p=mix(origin,p,assembled)+arc;
  vCoverage*=smoothstep(0.0,.14,uAssembly)*mix(.2,1.0,assembled);
  float sweepY=1.2-fract(uTime/8.0)*2.4;
  float sweep=exp(-pow((position.y-sweepY)/.08,2.0))*smoothstep(.1,.4,position.y);
  vReferenceColor*=1.0+sweep*.32*uThinking;
  vec4 viewPosition=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*viewPosition;
  gl_PointSize=aBaseSize*uPixelRatio*uViewportScale*clamp(6.1/-viewPosition.z,.8,1.2);
  vPulse=.97+.03*sin(uTime*uPulseSpeed+aSeed*24.0);
}
