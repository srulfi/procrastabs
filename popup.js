const Popup = {
	$maxTabsInput: document.querySelector("#maxtabs-input"),
	$maxTabsSwitch: document.querySelector("#maxtabs-switch"),
	$countdownInput: document.querySelector("#countdown-input"),
	$countdownSwitch: document.querySelector("#countdown-switch"),
	$message: document.querySelector("#message"),

	tabsCount: undefined,

	async init() {
		const config = await this.getConfigFromStorage()

		this.tabsCount = config.tabsCount
		this.$maxTabsInput.value = config.maxTabs
		this.$maxTabsSwitch.checked = config.maxTabsEnabled
		this.$countdownInput.value = config.countdown
		this.$countdownSwitch.checked = config.countdownEnabled

		this.setEventListeners()
		this.setStorageListeners()
	},

	async getConfigFromStorage() {
		try {
			const config = chrome.storage.sync.get([
				"tabsCount",
				"maxTabs",
				"maxTabsEnabled",
				"countdown",
				"countdownEnabled",
			])
			return config
		} catch (e) {
			this.displayErrorMessage(e)
		}
	},

	setEventListeners() {
		this.$maxTabsInput.addEventListener("change", () => {
			if (this.hasExtraTabs()) {
				this.setStorageItems({ maxTabsEnabled: false, countdownEnabled: false })
				this.disableMaxTabs()
				this.disableCountdown()
			}

			this.setStorageItems({ maxTabs: parseInt(this.$maxTabsInput.value) })
			this.resetMessage()
		})

		this.$maxTabsSwitch.addEventListener("change", () => {
			if (this.$maxTabsSwitch.checked) {
				if (this.hasExtraTabs()) {
					this.setStorageItems({ maxTabsEnabled: false })
					this.disableMaxTabs()
					this.displayTabsMessage()
				} else {
					this.setStorageItems({ maxTabsEnabled: true })
				}
			} else {
				this.setStorageItems({ maxTabsEnabled: false, countdownEnabled: false })
				this.disableCountdown()
				this.resetMessage()
			}
		})

		this.$countdownInput.addEventListener("change", () => {
			this.setStorageItems({ countdown: Number(this.$countdownInput.value) })
			this.resetMessage()
		})

		this.$countdownSwitch.addEventListener("change", () => {
			if (this.$countdownSwitch.checked) {
				if (this.hasExtraTabs()) {
					this.disableCountdown()
					this.displayTabsMessage()
				} else {
					this.setStorageItems({ maxTabsEnabled: true, countdownEnabled: true })
					this.enableMaxTabs()
				}
			} else {
				this.setStorageItems({ countdownEnabled: false })
				this.disableCountdown()
			}
		})
	},

	setStorageListeners() {
		chrome.storage.onChanged.addListener((changes) => {
			for (let [key, { newValue }] of Object.entries(changes)) {
				switch (key) {
					case "tabsCount":
						this.tabsCount = newValue
						break

					default:
						break
				}
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
		this.$maxTabsSwitch.checked = true
	},

	disableMaxTabs() {
		this.$maxTabsSwitch.checked = false
	},

	enableCountdown() {
		this.$countdownSwitch.checked = true
	},

	disableCountdown() {
		this.$countdownSwitch.checked = false
	},

	hasExtraTabs() {
		return Number(this.$maxTabsInput.value) < this.tabsCount
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
