document.addEventListener('DOMContentLoaded', () => {
	const input = document.getElementById('site-search');
	const button = document.querySelector('.search-row button');

	if (!input || !button) return;

	const openUrl = () => {
		const raw = input.value.trim();
		if (!raw) return;
		const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
		window.open(url, '_blank', 'noopener');
	};

	button.addEventListener('click', openUrl);
});
