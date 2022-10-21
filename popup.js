window.onload = function () {
	const $tabsInput = document.querySelector("#tabs-input")
	const $switch = document.querySelector("#switch")
	let tabsOpened

	$tabsInput.addEventListener("change", () => {
		const maxTabs = $tabsInput.value

		if (maxTabs < tabsOpened) {
			$switch.checked = false
		}

		chrome.storage.sync.set({ maxTabs })
	})

	chrome.storage.sync.get("tabsOpened", (result) => {
		tabsOpened = result.tabsOpened
		$tabsInput.value = tabsOpened
	})
}
