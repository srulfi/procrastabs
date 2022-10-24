const DEFAULT_MAX_TABS = 10
const DEFAULT_COUNTDOWN = 5

const Popup = {
	$maxTabsInput: document.querySelector("#maxtabs-input"),
	$maxTabsSwitch: document.querySelector("#maxtabs-switch"),
	$countdownInput: document.querySelector("#countdown-input"),
	$countdownSwitch: document.querySelector("#countdown-switch"),
	$message: document.querySelector("#message"),

	config: {
		maxTabs: DEFAULT_MAX_TABS,
		countdown: DEFAULT_COUNTDOWN,
	},
	openTabs: undefined,

	init() {
		this.setOpenTabsFromStorage()
		this.setListeners()
	},

	setOpenTabsFromStorage() {
		chrome.storage.sync.get("openTabs", (result) => {
			const { openTabs } = result

			this.openTabs = openTabs
			this.$maxTabsInput.value = this.config.maxTabs
			this.$countdownInput.value = this.config.countdown
		})
	},

	setListeners() {
		this.$maxTabsInput.addEventListener("change", () => {
			const maxTabs = this.$maxTabsInput.value

			if (maxTabs < this.openTabs) {
				this.$maxTabsSwitch.checked = false
				chrome.storage.sync.set({ maxTabsEnabled: false })
			}

			this.config.maxTabs = maxTabs
			this.resetMessage()

			chrome.storage.sync.set({ maxTabs })
		})

		this.$maxTabsSwitch.addEventListener("change", () => {
			if (this.config.maxTabs < this.openTabs && this.$maxTabsSwitch.checked) {
				this.$maxTabsSwitch.checked = false
				this.updateMessage()
			} else {
				this.resetMessage()
			}

			chrome.storage.sync.set({ maxTabsEnabled: this.$maxTabsSwitch.checked })
		})

		this.$countdownInput.addEventListener("change", () => {
			this.config.countdown = this.$countdownInput.value

			chrome.storage.sync.set({ countdown })
		})

		this.$countdownSwitch.addEventListener("change", () => {
			chrome.storage.sync.set({
				countdownEnabled: this.$countdownSwitch.checked,
			})
		})

		chrome.storage.onChanged.addListener((changes) => {
			const changesArray = Object.entries(changes)
			const [key, { newValue }] = changesArray[0]

			if (key === "openTabs") {
				this.openTabs = newValue
			}
		})
	},

	updateMessage() {
		const extraTabs = this.openTabs - this.config.maxTabs
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
