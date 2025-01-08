// Dark mode toggle function
function toggleDarkMode() {
    const body = document.body;
    const isDarkMode = body.classList.toggle('dark-mode'); // Toggle the class
    localStorage.setItem('darkModeEnabled', isDarkMode); // Save preference
}
// Apply saved theme on load
document.addEventListener('DOMContentLoaded', function () {
    const isDarkMode = localStorage.getItem('darkModeEnabled') === 'true';
    if (isDarkMode) {
    document.body.classList.add('dark-mode');
    }

    // Attach event listener for the toggle button
    document.getElementById('toggleDarkMode').addEventListener('click', toggleDarkMode);
});

// Start with feeds input open if no feeds 
document.addEventListener('DOMContentLoaded', function () {
    console.log(document.getElementById("rssInput").value);
    if(document.getElementById("rssInput").value.length == 0) {
    document.getElementById('feedDetails').open = true;
    }
});

function bookmarkMe() {
    const message = `
    Everything needd to reproduce your RSS feed is in the url of this page!
    Simply bookmark it or share it as a link to use it from anywhere.

    To bookmark this page in your browser: 
    
    Press CTRL + D (Windows/Linux) or Command + D (Mac). 
    `
    alert(message);
};
