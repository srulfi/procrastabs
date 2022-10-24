const DEFAULT_MAX_TABS = 10
const DEFAULT_COUNTDOWN_MINUTES = 5

const Popup = {
	$maxTabsInput: document.querySelector("#maxtabs-input"),
	$maxTabsSwitch: document.querySelector("#maxtabs-switch"),
	$countdownInput: document.querySelector("#countdown-input"),
	$countdownSwitch: document.querySelector("#countdown-switch"),
	$message: document.querySelector("#message"),

	config: {
		maxTabs: DEFAULT_MAX_TABS,
		countdown: DEFAULT_COUNTDOWN_MINUTES,
	},
	tabsCount: undefined,

	init() {
		this.$maxTabsInput.value = this.config.maxTabs
		this.$countdownInput.value = this.config.countdown

		this.setTabsCountFromStorage()
		this.setEventListeners()
		this.setStorageListeners()
	},

	setTabsCountFromStorage() {
		chrome.storage.sync.get("tabsCount", (result) => {
			const { tabsCount } = result

			this.tabsCount = tabsCount
		})
	},

	setEventListeners() {
		this.$maxTabsInput.addEventListener("change", () => {
			const maxTabs = parseInt(this.$maxTabsInput.value)

			if (maxTabs < this.tabsCount) {
				this.$maxTabsSwitch.checked = false
				chrome.storage.sync.set({ maxTabsEnabled: false })
			}

			this.config.maxTabs = maxTabs
			this.resetMessage()

			chrome.storage.sync.set({ maxTabs })
		})

		this.$maxTabsSwitch.addEventListener("change", () => {
			if (this.config.maxTabs < this.tabsCount && this.$maxTabsSwitch.checked) {
				this.$maxTabsSwitch.checked = false
				this.updateMessage()
			} else {
				this.resetMessage()
			}

			chrome.storage.sync.set({ maxTabsEnabled: this.$maxTabsSwitch.checked })
		})

		this.$countdownInput.addEventListener("change", () => {
			this.config.countdown = this.$countdownInput.value
			const countdownInSeconds = this.config.countdown * 60

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
		const extraTabs = this.tabsCount - this.config.maxTabs
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
