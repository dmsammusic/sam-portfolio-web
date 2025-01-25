function toggleMenu() {
	const menu = document.getElementById('mobile-menu');
	menu.classList.toggle('hidden');
}
// Update the current year dynamically
document.getElementById('current-year').textContent = new Date().getFullYear();
