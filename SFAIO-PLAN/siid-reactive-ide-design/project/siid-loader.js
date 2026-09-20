;(function () {
	var THREE_URL = "https://esm.sh/three@0.169.0"

	var PHASES = [
		{ speed: 0.55, morph: 0.7 },
		{ speed: 0.75, morph: 0.9 },
		{ speed: 0.95, morph: 1.0 },
		{ speed: 1.1, morph: 1.1 },
		{ speed: 1.3, morph: 1.25 },
		{ speed: 0.8, morph: 0.6 },
		{ speed: 0.4, morph: 0.35 },
	]

	var DISPLACE = [
		"  vec3 dirN = normalize(position);",
		"  float att = max(dot(dirN, normalize(uPoint)), 0.0);",
		"  float bulge = uBulge * (pow(att, 7.0) * 1.0 + pow(att, 2.5) * 0.22);",
		"  float dsp = 1.0 + uAmp * (",
		"      0.055 * sin(1.7 * dirN.x + (uTime + uPh) * 0.7)",
		"    + 0.045 * cos(1.9 * dirN.y - (uTime + uPh) * 0.55)",
		"    + 0.04  * sin(1.4 * dirN.z + (uTime + uPh) * 0.42)",
		"    + 0.03  * sin(2.6 * (dirN.x + dirN.y) + (uTime + uPh) * 0.9)) + bulge;",
	].join("\n")

	// Same displacement on the lit material and the sheen, so they never separate.
	function gpuMorph(mat, uTime, uAmp, uPh, uPoint, uBulge) {
		mat.onBeforeCompile = function (shader) {
			shader.uniforms.uTime = uTime
			shader.uniforms.uAmp = uAmp
			shader.uniforms.uPh = uPh
			shader.uniforms.uPoint = uPoint
			shader.uniforms.uBulge = uBulge
			shader.vertexShader =
				"uniform float uTime;\nuniform float uAmp;\nuniform float uPh;\nuniform vec3 uPoint;\nuniform float uBulge;\n" +
				shader.vertexShader.replace(
					"#include <begin_vertex>",
					"#include <begin_vertex>\n" + DISPLACE + "\n  transformed *= dsp;",
				)
		}
		mat.customProgramCacheKey = function () {
			return "siid-morph"
		}
		return mat
	}

	var FRESNEL_VERT = [
		"uniform float uTime;",
		"uniform float uAmp;",
		"uniform float uPh;",
		"uniform vec3 uPoint;",
		"uniform float uBulge;",
		"varying vec3 vN;",
		"varying vec3 vV;",
		"void main() {",
		DISPLACE,
		"  vec4 mv = modelViewMatrix * vec4(position * dsp, 1.0);",
		"  vN = normalize(normalMatrix * normal);",
		"  vV = normalize(-mv.xyz);",
		"  gl_Position = projectionMatrix * mv;",
		"}",
	].join("\n")

	var FRESNEL_FRAG = [
		"uniform vec3 uColA;",
		"uniform vec3 uColB;",
		"uniform float uPow;",
		"uniform float uGain;",
		"varying vec3 vN;",
		"varying vec3 vV;",
		"void main() {",
		"  vec3 n = normalize(vN);",
		"  float f = pow(1.0 - abs(dot(n, normalize(vV))), uPow);",
		"  float tilt = clamp(n.x * 0.5 + n.y * 0.5 + 0.5, 0.0, 1.0);",
		"  vec3 col = mix(uColA, uColB, tilt);",
		"  gl_FragColor = vec4(col, f * uGain);",
		"}",
	].join("\n")

	function envTexture(THREE) {
		var c = document.createElement("canvas")
		c.width = 128
		c.height = 64
		var g = c.getContext("2d")
		g.fillStyle = "#05060a"
		g.fillRect(0, 0, 128, 64)
		var spots = [
			[34, 18, 22, "rgba(90,220,235,0.75)"],
			[96, 30, 20, "rgba(180,90,200,0.45)"],
			[64, 6, 14, "rgba(120,200,255,0.35)"],
		]
		for (var i = 0; i < spots.length; i++) {
			var s = spots[i]
			var rg = g.createRadialGradient(s[0], s[1], 0, s[0], s[1], s[2])
			rg.addColorStop(0, s[3])
			rg.addColorStop(1, "rgba(0,0,0,0)")
			g.fillStyle = rg
			g.fillRect(0, 0, 128, 64)
		}
		var t = new THREE.CanvasTexture(c)
		t.mapping = THREE.EquirectangularReflectionMapping
		t.colorSpace = THREE.SRGBColorSpace
		return t
	}

	// Rounded-cube shell: a sphere pushed onto a superellipsoid, so the silhouette
	// reads as a soft squarish lobed form rather than a ball or a faceted crystal.
	function roundedCube(THREE, radius, segW, segH, power) {
		var geo = new THREE.SphereGeometry(1, segW, segH)
		var pos = geo.attributes.position
		var dirs = new Float32Array(pos.count * 3)
		var v = new THREE.Vector3()
		for (var i = 0; i < pos.count; i++) {
			v.fromBufferAttribute(pos, i).normalize()
			var q = Math.pow(
				Math.pow(Math.abs(v.x), power) + Math.pow(Math.abs(v.y), power) + Math.pow(Math.abs(v.z), power),
				-1 / power,
			)
			dirs[i * 3] = v.x
			dirs[i * 3 + 1] = v.y
			dirs[i * 3 + 2] = v.z
			v.multiplyScalar(q * radius)
			pos.setXYZ(i, v.x, v.y, v.z)
		}
		geo.computeVertexNormals()
		geo.userData.dirs = dirs
		geo.userData.radius = radius
		geo.userData.power = power
		return geo
	}

	class SiidLoader extends HTMLElement {
		static get observedAttributes() {
			return ["phase", "speed"]
		}

		constructor() {
			super()
			this._phase = 0
			this._speedProp = 1
			this._cur = { speed: 0.55, morph: 0.7 }
		}

		attributeChangedCallback(n, o, v) {
			if (n === "phase") this._phase = Math.max(0, Math.min(PHASES.length - 1, Number(v) || 0))
			if (n === "speed") this._speedProp = Number(v) || 1
		}

		set phase(v) {
			this._phase = Math.max(0, Math.min(PHASES.length - 1, Number(v) || 0))
		}
		get phase() {
			return this._phase
		}
		set speed(v) {
			this._speedProp = Number(v) || 1
		}

		connectedCallback() {
			if (this._booted) return
			this._booted = true
			this.style.display = "block"
			this.style.width = "100%"
			this.style.height = "100%"
			this.boot().catch(function (e) {
				console.error("[siid-loader] boot failed", e)
			})
		}

		disconnectedCallback() {
			this.teardown()
		}

		async boot() {
			var THREE = await import(THREE_URL)
			if (!this.isConnected) return
			this._THREE = THREE

			var canvas = document.createElement("canvas")
			canvas.style.cssText = "display:block;width:100%;height:100%;"
			this.appendChild(canvas)

			var renderer = new THREE.WebGLRenderer({
				canvas: canvas,
				antialias: true,
				alpha: true,
				powerPreference: "high-performance",
			})
			renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
			renderer.setClearColor(0x000000, 0)
			renderer.toneMapping = THREE.ACESFilmicToneMapping
			renderer.toneMappingExposure = 1.05
			this._renderer = renderer

			var scene = new THREE.Scene()
			var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40)
			camera.position.set(0, 0, 7.3)
			camera.lookAt(0, 0, 0)
			this._scene = scene
			this._camera = camera

			var pmrem = new THREE.PMREMGenerator(renderer)
			scene.environment = pmrem.fromEquirectangular(envTexture(THREE)).texture
			pmrem.dispose()

			scene.add(new THREE.AmbientLight(0x0b1020, 0.7))
			var key = new THREE.PointLight(0x5fe2f0, 26, 16)
			key.position.set(-2.2, 2.4, 2.6)
			scene.add(key)
			var rim = new THREE.PointLight(0xc060d8, 16, 16)
			rim.position.set(2.8, -1.2, -1.8)
			scene.add(rim)
			var fill = new THREE.PointLight(0x4f8cff, 8, 14)
			fill.position.set(1.6, 1.0, -2.6)
			scene.add(fill)

			this._uTime = { value: 0 }
			this._uAmp = { value: 0.7 }
			this._uAmpB = { value: 0.6 }
			this._uPh0 = { value: 0 }
			this._uPh1 = { value: 2.4 }
			this._uPoint = { value: new THREE.Vector3(0.6, 0.62, 0.5).normalize() }
			this._uBulge = { value: 0.1 }
			this._uNoBulge = { value: 0 }
			this._dotDir = new THREE.Vector3(0.6, 0.62, 0.5).normalize()
			this._qInv = new THREE.Quaternion()

			var world = new THREE.Group()
			world.rotation.set(0.18, 0.5, 0.42)
			scene.add(world)
			this._world = world

			// Outer soft shell — translucent, glossy, dark inside.
			this._shellGeo = roundedCube(THREE, 1.28, 72, 48, 4.2)
			var shell = new THREE.Mesh(
				this._shellGeo,
				gpuMorph(
					new THREE.MeshPhysicalMaterial({
						color: 0x9fd8e8,
						transmission: 1,
						thickness: 1.35,
						ior: 1.38,
						attenuationColor: new THREE.Color(0x04060e),
						attenuationDistance: 1.05,
						roughness: 0.075,
						metalness: 0,
						clearcoat: 1,
						clearcoatRoughness: 0.08,
						iridescence: 0.85,
						iridescenceIOR: 1.42,
						iridescenceThicknessRange: [180, 620],
						envMapIntensity: 0.9,
						transparent: true,
						side: THREE.DoubleSide,
						depthWrite: false,
					}),
					this._uTime,
					this._uAmp,
					this._uPh0,
					this._uPoint,
					this._uBulge,
				),
			)
			world.add(shell)
			this._shell = shell

			// A second lobe, turning against the first — the overlapping bulge in the reference.
			this._lobeGeo = roundedCube(THREE, 1.06, 56, 36, 3.4)
			var lobe = new THREE.Mesh(
				this._lobeGeo,
				gpuMorph(
					new THREE.MeshPhysicalMaterial({
						color: 0x86c8e0,
						transmission: 1,
						thickness: 1.1,
						ior: 1.34,
						attenuationColor: new THREE.Color(0x05070f),
						attenuationDistance: 0.9,
						roughness: 0.1,
						metalness: 0,
						clearcoat: 1,
						clearcoatRoughness: 0.12,
						iridescence: 0.6,
						iridescenceIOR: 1.38,
						iridescenceThicknessRange: [220, 700],
						envMapIntensity: 0.7,
						transparent: true,
						side: THREE.DoubleSide,
						depthWrite: false,
					}),
					this._uTime,
					this._uAmpB,
					this._uPh1,
					this._uPoint,
					this._uNoBulge,
				),
			)
			lobe.rotation.set(0.9, 0.6, -0.5)
			world.add(lobe)
			this._lobe = lobe

			// Soft aqua-to-violet sheen on the silhouette.
			var sheen = new THREE.Mesh(
				this._shellGeo,
				new THREE.ShaderMaterial({
					uniforms: {
						uColA: { value: new THREE.Color(0x6fe6f2) },
						uColB: { value: new THREE.Color(0xb96ad8) },
						uPow: { value: 2.2 },
						uGain: { value: 0.5 },
						uTime: this._uTime,
						uAmp: this._uAmp,
						uPh: this._uPh0,
						uPoint: this._uPoint,
						uBulge: this._uBulge,
					},
					vertexShader: FRESNEL_VERT,
					fragmentShader: FRESNEL_FRAG,
					transparent: true,
					depthWrite: false,
					blending: THREE.AdditiveBlending,
					side: THREE.FrontSide,
				}),
			)
			world.add(sheen)
			this._sheen = sheen

			var sg = document.createElement("canvas")
			sg.width = 64
			sg.height = 64
			var sctx = sg.getContext("2d")
			var srg = sctx.createRadialGradient(32, 32, 0, 32, 32, 32)
			srg.addColorStop(0, "rgba(255,255,255,0.95)")
			srg.addColorStop(0.25, "rgba(210,250,255,0.45)")
			srg.addColorStop(1, "rgba(160,230,255,0)")
			sctx.fillStyle = srg
			sctx.fillRect(0, 0, 64, 64)
			var spriteTex = new THREE.CanvasTexture(sg)
			spriteTex.colorSpace = THREE.SRGBColorSpace

			var glow = new THREE.Sprite(
				new THREE.SpriteMaterial({
					map: spriteTex,
					transparent: true,
					blending: THREE.AdditiveBlending,
					depthWrite: false,
					depthTest: false,
				}),
			)
			glow.scale.setScalar(0.46)
			scene.add(glow)
			this._glow = glow

			var dot = new THREE.Mesh(
				new THREE.SphereGeometry(0.019, 12, 10),
				new THREE.MeshBasicMaterial({
					color: 0xffffff,
					transparent: true,
					blending: THREE.AdditiveBlending,
					depthWrite: false,
					depthTest: false,
				}),
			)
			scene.add(dot)
			this._dot = dot

			var spark = new THREE.PointLight(0xdffaff, 7, 2.6)
			scene.add(spark)
			this._spark = spark

			this._surfaceAt = function (dir) {
				var p = 4.2
				var q = Math.pow(
					Math.pow(Math.abs(dir.x), p) + Math.pow(Math.abs(dir.y), p) + Math.pow(Math.abs(dir.z), p),
					-1 / p,
				)
				return q * 1.28
			}

			this._reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

			this._resize = () => {
				var w = this.clientWidth,
					h = this.clientHeight
				// A degenerate measurement means layout has not settled — don't cache it.
				if (w < 2 || h < 2) {
					this._needsSize = true
					return
				}
				this._needsSize = false
				if (w === this._lastW && h === this._lastH) return
				this._lastW = w
				this._lastH = h
				renderer.setSize(w, h, false)
				camera.aspect = w / h
				camera.updateProjectionMatrix()
				if (this._reduced) this.frame(0)
			}
			this._needsSize = true
			this._ro = new ResizeObserver(this._resize)
			this._ro.observe(this)
			this._resize()

			this._visible = true
			this._io = new IntersectionObserver(
				(e) => {
					this._visible = e[0].isIntersecting
					if (this._visible) {
						this._resize()
						this.start()
					} else this.stop()
				},
				{ threshold: 0.01 },
			)
			this._io.observe(this)

			this._onVis = () => {
				if (document.hidden) this.stop()
				else if (this._visible) {
					this._resize()
					this.start()
				}
			}
			document.addEventListener("visibilitychange", this._onVis)

			if (this._reduced) {
				this.frame(0)
				return
			}
			this.start()
		}

		start() {
			if (this._raf || this._reduced || !this._renderer) return
			if (this._resize) this._resize()
			var last = performance.now()
			var tick = (now) => {
				this._raf = requestAnimationFrame(tick)
				var dt = Math.min(0.05, (now - last) / 1000)
				last = now
				if (this._needsSize) this._resize()
				this.frame(dt)
			}
			this._raf = requestAnimationFrame(tick)
		}

		stop() {
			if (this._raf) {
				cancelAnimationFrame(this._raf)
				this._raf = 0
			}
		}

		frame(dt) {
			if (!this._THREE || !this._renderer) return
			var target = PHASES[this._phase] || PHASES[0]
			var c = this._cur,
				k = 1 - Math.pow(0.001, Math.max(dt, 0.0001))
			c.speed += (target.speed * this._speedProp - c.speed) * k
			c.morph += (target.morph - c.morph) * k

			this._t = (this._t || 0) + dt * c.speed
			var t = this._t

			this._uTime.value = t
			this._uAmp.value = c.morph
			this._uAmpB.value = c.morph * 0.85

			// The bright point wanders the upper-right of the form and drags the surface with it.
			this._dotDir
				.set(
					0.62 + 0.14 * Math.sin(t * 0.37),
					0.58 + 0.13 * Math.sin(t * 0.29 + 1.1),
					0.44 + 0.16 * Math.cos(t * 0.33),
				)
				.normalize()
			this._uBulge.value = 0.085 + 0.03 * Math.sin(t * 0.8)

			this._world.updateMatrixWorld()
			this._world.getWorldQuaternion(this._qInv).invert()
			this._uPoint.value.copy(this._dotDir).applyQuaternion(this._qInv)

			var rSurf = this._surfaceAt(this._uPoint.value) * (1 + this._uBulge.value)
			var world2 = this._dotDir.clone().multiplyScalar(rSurf * 0.93)
			this._dot.position.copy(world2)
			this._glow.position.copy(world2)
			this._spark.position.copy(this._dotDir).multiplyScalar(rSurf * 0.8)
			this._glow.material.opacity = 0.75 + 0.2 * Math.sin(t * 1.3)

			this._world.rotation.y += dt * 0.07
			this._world.rotation.x += dt * 0.022
			this._world.rotation.z += dt * 0.008
			this._lobe.rotation.y -= dt * 0.11
			this._lobe.rotation.x += dt * 0.035

			this._renderer.render(this._scene, this._camera)
		}

		teardown() {
			this.stop()
			if (this._ro) this._ro.disconnect()
			if (this._io) this._io.disconnect()
			if (this._onVis) document.removeEventListener("visibilitychange", this._onVis)
			if (this._scene) {
				this._scene.traverse(function (o) {
					if (o.geometry) o.geometry.dispose()
					if (o.material) {
						var mats = Array.isArray(o.material) ? o.material : [o.material]
						mats.forEach(function (m) {
							m.dispose()
						})
					}
				})
				if (this._scene.environment) this._scene.environment.dispose()
			}
			if (this._renderer) this._renderer.dispose()
			this._renderer = null
		}
	}

	if (!window.customElements.get("siid-loader")) window.customElements.define("siid-loader", SiidLoader)
})()
