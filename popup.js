const DEFAULT_MAX_TABS = 10
const DEFAULT_COUNTDOWN = 5

const Popup = {
	$maxTabsInput: document.querySelector("#maxtabs-input"),
	$maxTabsSwitch: document.querySelector("#maxtabs-switch"),
	$countdownInput: document.querySelector("#countdown-input"),
	$countdownSwitch: document.querySelector("#countdown-switch"),
	$message: document.querySelector("#message"),

	tabsCount: undefined,

	async init() {
		await this.setConfigFromStorage()

		this.setEventListeners()
		this.setStorageListeners()
	},

	setConfigFromStorage() {
		chrome.storage.sync
			.get([
				"tabsCount",
				"maxTabs",
				"maxTabsEnabled",
				"countdown",
				"countdownEnabled",
			])
			.then((config) => {
				this.tabsCount = config.tabsCount
				this.$maxTabsInput.value = config.maxTabs || DEFAULT_MAX_TABS
				this.$maxTabsSwitch.checked = config.maxTabsEnabled || false
				this.$countdownInput.value = config.countdown / 60 || DEFAULT_COUNTDOWN
				this.$countdownSwitch.checked = config.countdownEnabled || false
			})
			.catch((e) => this.displayErrorMessage(e))
	},

	setEventListeners() {
		this.$maxTabsInput.addEventListener("change", () => {
			if (this.hasExtraTabs()) {
				this.disableMaxTabs()
				this.disableCountdown()
			}

			this.resetMessage()
			this.setStorageItems({ maxTabs: parseInt(this.$maxTabsInput.value) })
		})

		this.$maxTabsSwitch.addEventListener("change", () => {
			if (this.$maxTabsSwitch.checked) {
				if (this.hasExtraTabs()) {
					this.disableMaxTabs()
					this.displayTabsMessage()
				} else {
					this.enableMaxTabs()
				}
			} else {
				this.disableMaxTabs()
				this.disableCountdown()
				this.resetMessage()
			}
		})

		this.$countdownInput.addEventListener("change", () => {
			const countdownInSeconds = this.$countdownInput.value * 60
			this.setStorageItems({ countdown: countdownInSeconds })
		})

		this.$countdownSwitch.addEventListener("change", () => {
			if (this.$countdownSwitch.checked) {
				if (this.hasExtraTabs()) {
					this.disableCountdown()
					this.displayTabsMessage()
				} else {
					this.enableCountdown()
					this.enableMaxTabs()
				}
			} else {
				this.disableCountdown()
			}
		})
	},

	setStorageListeners() {
		chrome.storage.onChanged.addListener((changes) => {
			const changesArray = Object.entries(changes)
			const [key, { newValue }] = changesArray[0]

			if (key === "tabsCount") {
				this.tabsCount = newValue
			}
		})
	},

	setStorageItems(items, callback) {
		chrome.storage.sync
			.set(items)
			.then(callback)
			.catch((e) => this.displayErrorMessage(e))
	},

	enableMaxTabs() {
		this.setStorageItems(
			{ maxTabsEnabled: true },
			() => (this.$maxTabsSwitch.checked = true)
		)
	},

	disableMaxTabs() {
		this.setStorageItems(
			{ maxTabsEnabled: false },
			() => (this.$maxTabsSwitch.checked = false)
		)
	},

	enableCountdown() {
		this.setStorageItems(
			{ countdownEnabled: true },
			() => (this.$countdownSwitch.checked = true)
		)
	},

	disableCountdown() {
		this.setStorageItems(
			{ countdownEnabled: false },
			() => (this.$countdownSwitch.checked = false)
		)
	},

	hasExtraTabs() {
		return parseInt(this.$maxTabsInput.value) < this.tabsCount
	},

	displayErrorMessage(e) {
		console.error(e)
		this.$message.textContent = "Something went wrong, please try again later."
	},

	displayTabsMessage() {
		const extraTabs = this.tabsCount - this.$maxTabsInput.value
		const tabText = extraTabs > 1 ? "tabs" : "tab"

		this.$message.textContent = `You need to close ${extraTabs} ${tabText}.`
	},

	resetMessage() {
		this.$message.textContent = ""
	},
}

window.onload = () => Popup.init()
