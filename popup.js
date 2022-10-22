const DEFAULT_MAX_TABS = 10

const Popup = {
	$tabsInput: document.querySelector("#tabs-input"),
	$switch: document.querySelector("#switch"),
	$message: document.querySelector("#message"),

	config: {
		maxTabs: undefined,
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
			this.config.maxTabs =
				openTabs > DEFAULT_MAX_TABS ? DEFAULT_MAX_TABS : openTabs
			this.$tabsInput.value = this.config.maxTabs
		})
	},

	setListeners() {
		this.$tabsInput.addEventListener("change", () => {
			const maxTabs = this.$tabsInput.value

			if (maxTabs < this.openTabs) {
				this.$switch.checked = false
				chrome.storage.sync.set({ enabled: false })
			}

			this.config.maxTabs = maxTabs
			this.resetMessage()

			chrome.storage.sync.set({ maxTabs })
		})

		this.$switch.addEventListener("change", () => {
			if (this.config.maxTabs < this.openTabs && this.$switch.checked) {
				this.$switch.checked = false
				this.updateMessage()
			} else {
				this.resetMessage()
			}

			chrome.storage.sync.set({ enabled: this.$switch.checked })
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

		this.$message.textContent = `You have ${extraTabs} more ${tabText} than allowed.`
	},

	resetMessage() {
		this.$message.textContent = ""
	},
}

window.onload = () => {
	Popup.init()
}
