const { InstanceBase, runEntrypoint, InstanceStatus, combineRgb } = require('@companion-module/base')

class SpeechTimerInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.presets = []
		this.state = {
			running: false,
			paused: false,
			stopped: false,
			phase: 'idle',
			elapsed: 0,
			remaining: 0,
			duration: 0,
			preset_name: '',
			overtime: false,
			current_time: '',
			time_formatted: '00:00',
			display_mode: 'timer',
		}
		this.pollTimer = null
		this.presetsTimer = null
		this.isConnected = false
	}

	async init(config) {
		this.config = config
		this.updateStatus(InstanceStatus.Connecting)
		this.setupDefinitions()

		if (!this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, 'Host missing')
			return
		}

		this.log('info', 'Connecting to Speech Timer at ' + this.getBaseUrl())

		const ok = await this.loadPresets()
		if (ok) {
			this.updateStatus(InstanceStatus.Ok)
			this.isConnected = true
		}

		this.startPolling()
		this.startPresetsRefresh()
	}

	async destroy() {
		this.stopPolling()
		this.stopPresetsRefresh()
	}

	async configUpdated(config) {
		const hostChanged =
			this.config === undefined ||
			this.config.host !== config.host ||
			this.config.port !== config.port

		this.config = config

		if (hostChanged) {
			this.stopPolling()
			this.stopPresetsRefresh()
			this.isConnected = false
			this.updateStatus(InstanceStatus.Connecting)

			if (!this.config.host) {
				this.updateStatus(InstanceStatus.BadConfig, 'Host missing')
				return
			}

			await this.loadPresets()
			this.startPolling()
			this.startPresetsRefresh()
		}
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value: 'Control a Speech Timer on a Raspberry Pi. Enter the IP address of the Pi below.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 8,
				default: '',
				tooltip: 'IP address, e.g. 192.168.1.42',
			},
			{
				type: 'number',
				id: 'port',
				label: 'Port',
				width: 4,
				default: 5000,
				min: 1,
				max: 65535,
			},
			{
				type: 'number',
				id: 'poll_interval',
				label: 'Poll interval (ms)',
				width: 6,
				default: 500,
				min: 100,
				max: 5000,
			},
		]
	}

	// ============================================================
	// HTTP
	// ============================================================
	getBaseUrl() {
		const host = this.config && this.config.host ? this.config.host : ''
		const port = this.config && this.config.port ? this.config.port : 5000
		return 'http://' + host + ':' + port
	}

	async httpRequest(path, options) {
		options = options || {}
		const url = this.getBaseUrl() + path
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), options.timeout || 3000)

		try {
			const res = await fetch(url, {
				method: options.method || 'GET',
				headers: { 'Content-Type': 'application/json' },
				body: options.body ? JSON.stringify(options.body) : undefined,
				signal: controller.signal,
			})
			clearTimeout(timeoutId)

			if (!res.ok) {
				this.log('warn', 'HTTP ' + res.status + ' on ' + path)
				return null
			}
			return await res.json()
		} catch (err) {
			clearTimeout(timeoutId)
			if (err.name === 'AbortError') {
				this.log('debug', 'HTTP timeout on ' + path)
			} else {
				this.log('debug', 'HTTP error on ' + path + ': ' + err.message)
			}
			return null
		}
	}

	async loadPresets() {
		const data = await this.httpRequest('/api/presets')
		if (data && Array.isArray(data)) {
			const prevCount = this.presets.length
			this.presets = data
			if (prevCount !== data.length) {
				this.log('info', 'Loaded ' + this.presets.length + ' presets')
				this.setupDefinitions()
			}
			return true
		}
		return false
	}

	async loadDisplayMode() {
		const data = await this.httpRequest('/api/display')
		if (data && data.mode) {
			this.state.display_mode = data.mode
		}
	}

	// ============================================================
	// Polling
	// ============================================================
	startPolling() {
		this.stopPolling()
		const interval = Math.max(100, (this.config && this.config.poll_interval) || 500)

		const poll = async () => {
			const data = await this.httpRequest('/api/timer/status')
			if (data) {
				if (!this.isConnected) {
					this.isConnected = true
					this.updateStatus(InstanceStatus.Ok)
					this.log('info', 'Connected to ' + this.getBaseUrl())
					await this.loadDisplayMode()
				}
				this.handleTimerUpdate(data)
			} else {
				if (this.isConnected) {
					this.isConnected = false
					this.updateStatus(InstanceStatus.ConnectionFailure, 'Timer not reachable')
				}
			}
			this.pollTimer = setTimeout(poll, interval)
		}

		this.pollTimer = setTimeout(poll, 0)
	}

	stopPolling() {
		if (this.pollTimer) {
			clearTimeout(this.pollTimer)
			this.pollTimer = null
		}
	}

	startPresetsRefresh() {
		this.stopPresetsRefresh()
		this.presetsTimer = setInterval(() => {
			this.loadPresets()
			this.loadDisplayMode()
		}, 30000)
	}

	stopPresetsRefresh() {
		if (this.presetsTimer) {
			clearInterval(this.presetsTimer)
			this.presetsTimer = null
		}
	}

	// ============================================================
	// State
	// ============================================================
	handleTimerUpdate(data) {
		const prev = { ...this.state }

		this.state.running = !!data.running
		this.state.paused = !!data.paused
		this.state.stopped = !!data.stopped
		this.state.phase = data.phase || 'idle'
		this.state.elapsed = Math.floor(data.elapsed || 0)
		this.state.remaining = Math.floor(data.remaining || 0)
		this.state.duration = Math.floor(data.duration || 0)
		this.state.preset_name = data.preset_name || ''
		this.state.overtime = !!data.overtime
		this.state.current_time = data.current_time || ''
		this.state.time_formatted = this.formatTime(data.remaining || 0)

		this.updateVariables()

		if (
			prev.phase !== this.state.phase ||
			prev.running !== this.state.running ||
			prev.paused !== this.state.paused ||
			prev.stopped !== this.state.stopped ||
			prev.overtime !== this.state.overtime ||
			prev.display_mode !== this.state.display_mode
		) {
			this.checkFeedbacks()
		} else {
			this.checkFeedbacks('timer_state')
		}
	}

	formatTime(seconds) {
		const s = Math.floor(Math.abs(seconds))
		const sign = seconds < 0 ? '-' : ''
		const h = Math.floor(s / 3600)
		const m = Math.floor((s % 3600) / 60)
		const sec = s % 60
		const pad = (n) => String(n).padStart(2, '0')
		if (h > 0) return sign + h + ':' + pad(m) + ':' + pad(sec)
		return sign + pad(m) + ':' + pad(sec)
	}

	getStatusText() {
		const map = {
			idle: 'READY',
			loaded: 'LOADED',
			normal: 'RUNNING',
			warning1: 'WARNING 1',
			warning2: 'WARNING 2',
			overtime: 'OVERTIME',
			paused: 'PAUSED',
			stopped: 'STOPPED',
		}
		return map[this.state.phase] || 'READY'
	}

	updateVariables() {
		this.setVariableValues({
			running: this.state.running ? 1 : 0,
			paused: this.state.paused ? 1 : 0,
			stopped: this.state.stopped ? 1 : 0,
			phase: this.state.phase,
			elapsed: this.state.elapsed,
			remaining: this.state.remaining,
			duration: this.state.duration,
			time_formatted: this.state.time_formatted,
			preset_name: this.state.preset_name,
			overtime: this.state.overtime ? 1 : 0,
			current_time: this.state.current_time,
			status_text: this.getStatusText(),
			display_mode: this.state.display_mode,
		})
	}

	// ============================================================
	// Definitions
	// ============================================================
	setupDefinitions() {
		this.setActionDefinitions(this.getActionDefinitions())
		this.setFeedbackDefinitions(this.getFeedbackDefinitions())
		this.setVariableDefinitions(this.getVariableDefinitions())
		this.setPresetDefinitions(this.getPresetDefinitions())
	}

	getVariableDefinitions() {
		return [
			{ variableId: 'time_formatted', name: 'Remaining time (MM:SS)' },
			{ variableId: 'remaining', name: 'Remaining seconds' },
			{ variableId: 'elapsed', name: 'Elapsed seconds' },
			{ variableId: 'duration', name: 'Total duration (seconds)' },
			{ variableId: 'running', name: 'Running (1/0)' },
			{ variableId: 'paused', name: 'Paused (1/0)' },
			{ variableId: 'stopped', name: 'Stopped (1/0)' },
			{ variableId: 'overtime', name: 'Overtime (1/0)' },
			{ variableId: 'phase', name: 'Phase' },
			{ variableId: 'preset_name', name: 'Current preset name' },
			{ variableId: 'current_time', name: 'Clock time from Pi' },
			{ variableId: 'status_text', name: 'Status text' },
			{ variableId: 'display_mode', name: 'Display mode (timer/clock)' },
		]
	}

	getActionDefinitions() {
		const self = this
		let presetChoices = this.presets.map((p) => ({
			id: p.id,
			label: p.name + ' (' + Math.floor(p.duration / 60) + ':' + String(p.duration % 60).padStart(2, '0') + ')',
		}))
		if (presetChoices.length === 0) {
			presetChoices = [{ id: 0, label: '— No presets loaded —' }]
		}

		return {
			load_preset: {
				name: 'Load Preset (no start)',
				description: 'Loads a preset without starting the timer',
				options: [
					{
						id: 'preset_id',
						type: 'dropdown',
						label: 'Preset',
						default: presetChoices[0].id,
						choices: presetChoices,
					},
				],
				callback: async (action) => {
					const presetId = parseInt(action.options.preset_id)
					const preset = self.presets.find((p) => p.id === presetId)
					if (!preset) return
					await self.httpRequest('/api/timer/load', {
						method: 'POST',
						body: {
							duration: preset.duration,
							warning1: preset.warning1,
							warning2: preset.warning2,
							preset_name: preset.name,
						},
					})
				},
			},
			load_manual: {
				name: 'Load Manual Time (no start)',
				options: [
					{ id: 'duration', type: 'number', label: 'Duration (sec)', default: 300, min: 1, max: 36000 },
					{ id: 'warning1', type: 'number', label: 'Warning 1 (sec before end)', default: 60, min: 0, max: 3600 },
					{ id: 'warning2', type: 'number', label: 'Warning 2 (sec before end)', default: 30, min: 0, max: 3600 },
				],
				callback: async (action) => {
					await self.httpRequest('/api/timer/load', {
						method: 'POST',
						body: {
							duration: Math.max(1, parseInt(action.options.duration)),
							warning1: Math.max(0, parseInt(action.options.warning1)),
							warning2: Math.max(0, parseInt(action.options.warning2)),
							preset_name: 'Manual',
						},
					})
				},
			},
			start: {
				name: 'Start / Resume',
				description: 'Starts the loaded timer or resumes if paused',
				options: [],
				callback: async () => {
					await self.httpRequest('/api/timer/start', { method: 'POST' })
				},
			},
			pause: {
				name: 'Pause / Resume (toggle)',
				options: [],
				callback: async () => {
					await self.httpRequest('/api/timer/pause', { method: 'POST' })
				},
			},
			stop: {
				name: 'Stop',
				description: 'Stops the timer and sets to 00:00',
				options: [],
				callback: async () => {
					await self.httpRequest('/api/timer/stop', { method: 'POST' })
				},
			},
			reset: {
				name: 'Reset',
				description: 'Resets the timer and clears the loaded preset',
				options: [],
				callback: async () => {
					await self.httpRequest('/api/timer/reset', { method: 'POST' })
				},
			},
			adjust: {
				name: 'Adjust Time',
				description: 'Adds or subtracts time (works also during running timer)',
				options: [
					{
						id: 'seconds',
						type: 'number',
						label: 'Seconds (positive or negative)',
						default: 60,
						min: -3600,
						max: 3600,
					},
				],
				callback: async (action) => {
					const seconds = parseInt(action.options.seconds)
					await self.httpRequest('/api/timer/adjust', {
						method: 'POST',
						body: { seconds: seconds },
					})
				},
			},
			adjust_plus_1: {
				name: 'Adjust +1 minute',
				options: [],
				callback: async () => {
					await self.httpRequest('/api/timer/adjust', { method: 'POST', body: { seconds: 60 } })
				},
			},
			adjust_minus_1: {
				name: 'Adjust -1 minute',
				options: [],
				callback: async () => {
					await self.httpRequest('/api/timer/adjust', { method: 'POST', body: { seconds: -60 } })
				},
			},
			adjust_plus_5: {
				name: 'Adjust +5 minutes',
				options: [],
				callback: async () => {
					await self.httpRequest('/api/timer/adjust', { method: 'POST', body: { seconds: 300 } })
				},
			},
			adjust_minus_5: {
				name: 'Adjust -5 minutes',
				options: [],
				callback: async () => {
					await self.httpRequest('/api/timer/adjust', { method: 'POST', body: { seconds: -300 } })
				},
			},
			display_mode_set: {
				name: 'Set Display Mode',
				description: 'Switch display between Timer and Clock mode',
				options: [
					{
						id: 'mode',
						type: 'dropdown',
						label: 'Mode',
						default: 'timer',
						choices: [
							{ id: 'timer', label: 'Timer' },
							{ id: 'clock', label: 'Clock' },
						],
					},
				],
				callback: async (action) => {
					const data = await self.httpRequest('/api/display/mode', {
						method: 'POST',
						body: { mode: action.options.mode },
					})
					if (data && data.mode) {
						self.state.display_mode = data.mode
						self.updateVariables()
						self.checkFeedbacks('display_mode_is')
					}
				},
			},
			display_mode_toggle: {
				name: 'Toggle Display Mode',
				description: 'Toggles between Timer and Clock mode',
				options: [],
				callback: async () => {
					const data = await self.httpRequest('/api/display/mode/toggle', { method: 'POST' })
					if (data && data.mode) {
						self.state.display_mode = data.mode
						self.updateVariables()
						self.checkFeedbacks('display_mode_is')
					}
				},
			},
			refresh_presets: {
				name: 'Refresh Presets',
				options: [],
				callback: async () => {
					await self.loadPresets()
				},
			},
		}
	}

	getFeedbackDefinitions() {
		const self = this
		return {
			timer_state: {
				type: 'advanced',
				name: 'Timer State (complete)',
				description: 'Changes background color based on current phase',
				options: [
					{ id: 'normal_bg', type: 'colorpicker', label: 'Background Normal', default: combineRgb(0, 0, 0) },
					{ id: 'warning1_bg', type: 'colorpicker', label: 'Background Warning 1', default: combineRgb(255, 170, 0) },
					{ id: 'warning2_bg', type: 'colorpicker', label: 'Background Warning 2', default: combineRgb(255, 0, 0) },
					{ id: 'overtime_bg', type: 'colorpicker', label: 'Background Overtime', default: combineRgb(255, 0, 0) },
					{ id: 'paused_bg', type: 'colorpicker', label: 'Background Paused', default: combineRgb(80, 80, 200) },
					{ id: 'stopped_bg', type: 'colorpicker', label: 'Background Stopped', default: combineRgb(60, 60, 60) },
					{ id: 'text_color', type: 'colorpicker', label: 'Text color', default: combineRgb(255, 255, 255) },
				],
				callback: (feedback) => {
					const opts = feedback.options
					switch (self.state.phase) {
						case 'paused': return { bgcolor: opts.paused_bg, color: opts.text_color }
						case 'stopped': return { bgcolor: opts.stopped_bg, color: opts.text_color }
						case 'warning1': return { bgcolor: opts.warning1_bg, color: opts.text_color }
						case 'warning2': return { bgcolor: opts.warning2_bg, color: opts.text_color }
						case 'overtime': return { bgcolor: opts.overtime_bg, color: opts.text_color }
						case 'normal': return { bgcolor: opts.normal_bg, color: opts.text_color }
						default: return {}
					}
				},
			},
			timer_phase: {
				type: 'boolean',
				name: 'Timer Phase is …',
				defaultStyle: { bgcolor: combineRgb(255, 170, 0), color: combineRgb(0, 0, 0) },
				options: [
					{
						id: 'phase',
						type: 'dropdown',
						label: 'Phase',
						default: 'warning1',
						choices: [
							{ id: 'idle', label: 'Idle' },
							{ id: 'loaded', label: 'Loaded' },
							{ id: 'normal', label: 'Normal (running)' },
							{ id: 'warning1', label: 'Warning 1' },
							{ id: 'warning2', label: 'Warning 2' },
							{ id: 'overtime', label: 'Overtime' },
							{ id: 'paused', label: 'Paused' },
							{ id: 'stopped', label: 'Stopped' },
						],
					},
				],
				callback: (feedback) => self.state.phase === feedback.options.phase,
			},
			timer_running: {
				type: 'boolean',
				name: 'Timer is running',
				defaultStyle: { bgcolor: combineRgb(0, 120, 0), color: combineRgb(255, 255, 255) },
				options: [],
				callback: () => self.state.running && !self.state.paused,
			},
			timer_paused: {
				type: 'boolean',
				name: 'Timer is paused',
				defaultStyle: { bgcolor: combineRgb(80, 80, 200), color: combineRgb(255, 255, 255) },
				options: [],
				callback: () => self.state.paused,
			},
			timer_overtime: {
				type: 'boolean',
				name: 'Timer is in overtime',
				defaultStyle: { bgcolor: combineRgb(255, 0, 0), color: combineRgb(255, 255, 255) },
				options: [],
				callback: () => self.state.overtime || self.state.phase === 'overtime',
			},
			display_mode_is: {
				type: 'boolean',
				name: 'Display mode is …',
				defaultStyle: { bgcolor: combineRgb(0, 150, 200), color: combineRgb(255, 255, 255) },
				options: [
					{
						id: 'mode',
						type: 'dropdown',
						label: 'Mode',
						default: 'clock',
						choices: [
							{ id: 'timer', label: 'Timer' },
							{ id: 'clock', label: 'Clock' },
						],
					},
				],
				callback: (feedback) => self.state.display_mode === feedback.options.mode,
			},
		}
	}

	getPresetDefinitions() {
		const presets = {}

		// --- Kategorie: Display ---
		presets['timer_display'] = {
			type: 'button',
			category: 'Display',
			name: 'Timer Display',
			style: {
				text: '$(speech-timer-pi:time_formatted)\\n$(speech-timer-pi:preset_name)',
				size: '24',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
				alignment: 'center:center',
			},
			steps: [{ down: [], up: [] }],
			feedbacks: [
				{
					feedbackId: 'timer_state',
					options: {
						normal_bg: combineRgb(0, 0, 0),
						warning1_bg: combineRgb(255, 170, 0),
						warning2_bg: combineRgb(255, 0, 0),
						overtime_bg: combineRgb(255, 0, 0),
						paused_bg: combineRgb(80, 80, 200),
						stopped_bg: combineRgb(60, 60, 60),
						text_color: combineRgb(255, 255, 255),
					},
				},
			],
		}

		presets['status_button'] = {
			type: 'button',
			category: 'Display',
			name: 'Status',
			style: {
				text: '$(speech-timer-pi:status_text)\\n$(speech-timer-pi:preset_name)',
				size: '18',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(40, 40, 40),
				alignment: 'center:center',
			},
			steps: [{ down: [], up: [] }],
			feedbacks: [],
		}

		// --- Kategorie: Control ---
		presets['start'] = {
			type: 'button',
			category: 'Control',
			name: 'Start / Resume',
			style: {
				text: 'START',
				size: '24',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 120, 0),
			},
			steps: [{ down: [{ actionId: 'start', options: {} }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'timer_running',
					style: { bgcolor: combineRgb(0, 80, 0), color: combineRgb(180, 180, 180) },
				},
			],
		}

		presets['pause_resume'] = {
			type: 'button',
			category: 'Control',
			name: 'Pause / Resume',
			style: {
				text: 'PAUSE',
				size: '24',
				color: combineRgb(0, 0, 0),
				bgcolor: combineRgb(255, 170, 0),
			},
			steps: [{ down: [{ actionId: 'pause', options: {} }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'timer_paused',
					style: {
						text: 'RESUME',
						bgcolor: combineRgb(0, 120, 0),
						color: combineRgb(255, 255, 255),
					},
				},
			],
		}

		presets['stop'] = {
			type: 'button',
			category: 'Control',
			name: 'Stop',
			style: { text: 'STOP', size: '24', color: combineRgb(255, 255, 255), bgcolor: combineRgb(180, 0, 0) },
			steps: [{ down: [{ actionId: 'stop', options: {} }], up: [] }],
			feedbacks: [],
		}

		presets['reset'] = {
			type: 'button',
			category: 'Control',
			name: 'Reset',
			style: { text: 'RESET', size: '24', color: combineRgb(255, 255, 255), bgcolor: combineRgb(100, 100, 100) },
			steps: [{ down: [{ actionId: 'reset', options: {} }], up: [] }],
			feedbacks: [],
		}

		// --- Kategorie: Adjust ---
		presets['adjust_plus_1'] = {
			type: 'button',
			category: 'Adjust Time',
			name: '+1 Minute',
			style: { text: '+1 MIN', size: '18', color: combineRgb(255, 255, 255), bgcolor: combineRgb(5, 150, 105) },
			steps: [{ down: [{ actionId: 'adjust_plus_1', options: {} }], up: [] }],
			feedbacks: [],
		}

		presets['adjust_minus_1'] = {
			type: 'button',
			category: 'Adjust Time',
			name: '-1 Minute',
			style: { text: '-1 MIN', size: '18', color: combineRgb(255, 255, 255), bgcolor: combineRgb(71, 85, 105) },
			steps: [{ down: [{ actionId: 'adjust_minus_1', options: {} }], up: [] }],
			feedbacks: [],
		}

		presets['adjust_plus_5'] = {
			type: 'button',
			category: 'Adjust Time',
			name: '+5 Minutes',
			style: { text: '+5 MIN', size: '18', color: combineRgb(255, 255, 255), bgcolor: combineRgb(5, 150, 105) },
			steps: [{ down: [{ actionId: 'adjust_plus_5', options: {} }], up: [] }],
			feedbacks: [],
		}

		presets['adjust_minus_5'] = {
			type: 'button',
			category: 'Adjust Time',
			name: '-5 Minutes',
			style: { text: '-5 MIN', size: '18', color: combineRgb(255, 255, 255), bgcolor: combineRgb(71, 85, 105) },
			steps: [{ down: [{ actionId: 'adjust_minus_5', options: {} }], up: [] }],
			feedbacks: [],
		}

		// --- Kategorie: Display Mode ---
		presets['display_mode_toggle'] = {
			type: 'button',
			category: 'Display Mode',
			name: 'Toggle Timer/Clock',
			style: {
				text: '$(speech-timer-pi:display_mode)',
				size: '18',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 80, 160),
			},
			steps: [{ down: [{ actionId: 'display_mode_toggle', options: {} }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'display_mode_is',
					options: { mode: 'clock' },
					style: {
						text: 'CLOCK',
						bgcolor: combineRgb(100, 50, 150),
						color: combineRgb(255, 255, 255),
					},
				},
			],
		}

		presets['display_mode_timer'] = {
			type: 'button',
			category: 'Display Mode',
			name: 'Switch to Timer',
			style: { text: 'TIMER', size: '18', color: combineRgb(255, 255, 255), bgcolor: combineRgb(0, 80, 160) },
			steps: [{ down: [{ actionId: 'display_mode_set', options: { mode: 'timer' } }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'display_mode_is',
					options: { mode: 'timer' },
					style: { bgcolor: combineRgb(0, 160, 80), color: combineRgb(255, 255, 255) },
				},
			],
		}

		presets['display_mode_clock'] = {
			type: 'button',
			category: 'Display Mode',
			name: 'Switch to Clock',
			style: { text: 'CLOCK', size: '18', color: combineRgb(255, 255, 255), bgcolor: combineRgb(100, 50, 150) },
			steps: [{ down: [{ actionId: 'display_mode_set', options: { mode: 'clock' } }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'display_mode_is',
					options: { mode: 'clock' },
					style: { bgcolor: combineRgb(0, 160, 80), color: combineRgb(255, 255, 255) },
				},
			],
		}

		// --- Kategorie: Presets (dynamisch) ---
		this.presets.forEach((preset) => {
			const m = Math.floor(preset.duration / 60)
			const s = String(preset.duration % 60).padStart(2, '0')
			presets['preset_load_' + preset.id] = {
				type: 'button',
				category: 'Load Presets',
				name: 'Load: ' + preset.name,
				style: {
					text: preset.name + '\\n' + m + ':' + s,
					size: '14',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(0, 80, 160),
				},
				steps: [
					{
						down: [{ actionId: 'load_preset', options: { preset_id: preset.id } }],
						up: [],
					},
				],
				feedbacks: [],
			}
		})

		return presets
	}
}

runEntrypoint(SpeechTimerInstance, [])
