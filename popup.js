const DEFAULT_MAX_TABS = 10
const DEFAULT_COUNTDOWN_MINUTES = 5

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

	async setConfigFromStorage() {
		const { tabsCount, maxTabs, maxTabsEnabled, countdown, countdownEnabled } =
			await chrome.storage.sync.get([
				"tabsCount",
				"maxTabs",
				"maxTabsEnabled",
				"countdown",
				"countdownEnabled",
			])

		this.tabsCount = tabsCount
		this.$maxTabsInput.value = maxTabs || DEFAULT_MAX_TABS
		this.$maxTabsSwitch.checked = maxTabsEnabled || false
		this.$countdownInput.value = countdown / 60 || DEFAULT_COUNTDOWN_MINUTES
		this.$countdownSwitch.checked = countdownEnabled || false
	},

	setEventListeners() {
		this.$maxTabsInput.addEventListener("change", () => {
			const maxTabs = parseInt(this.$maxTabsInput.value)

			if (maxTabs < this.tabsCount) {
				this.$maxTabsSwitch.checked = false
				chrome.storage.sync.set({ maxTabsEnabled: false })
			}

			this.resetMessage()

			chrome.storage.sync.set({ maxTabs })
		})

		this.$maxTabsSwitch.addEventListener("change", () => {
			if (
				this.$maxTabsInput.value < this.tabsCount &&
				this.$maxTabsSwitch.checked
			) {
				this.$maxTabsSwitch.checked = false
				this.updateMessage()
			} else {
				this.resetMessage()
			}

			chrome.storage.sync.set({ maxTabsEnabled: this.$maxTabsSwitch.checked })
		})

		this.$countdownInput.addEventListener("change", () => {
			const countdownInSeconds = this.$countdownInput.value * 60

			chrome.storage.sync.set({ countdown: countdownInSeconds })
		})

		this.$countdownSwitch.addEventListener("change", () => {
			chrome.storage.sync.set({
				countdownEnabled: this.$countdownSwitch.checked,
			})
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

	updateMessage() {
		const extraTabs = this.tabsCount - this.$maxTabsInput.value
		const tabText = extraTabs > 1 ? "tabs" : "tab"

		this.$message.textContent = `You need to close ${extraTabs} ${tabText}.`
	},

	resetMessage() {
		this.$message.textContent = ""
	},
}

window.onload = () => {
	Popup.init()
}
