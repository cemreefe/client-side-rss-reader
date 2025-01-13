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
    if(document.getElementById("rssInput").value.length == 0) {
        document.getElementById('feedDetails').open = true;
    }
});

function bookmarkMe() {
    const message = `
The URL of this page contains all your feeds!
Simply bookmark it or share it as a link to use it from anywhere.

To bookmark this page in your browser Simpy press CTRL + D !
(or Command + D for MacOS)`
    alert(message);
};

// Taken from https://rssgizmos.com/opmlmaker.html, with minor edits
function generateOpml() {
    let urlTextarea = document.getElementById('rssInput');
    let urls = urlTextarea.value.split(',');
    let opmlContent = `<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
            <head>
                <title>OPML Feeds</title>
            </head>
            <body>`;
    
    urls.forEach(url => {
        url = url.trim();
        if (url !== '') { // Ignore empty lines
            opmlContent += `
                <outline text="${url}" title="${url}" type="rss" xmlUrl="${url}" htmlUrl="${url}" />`;
        }
    });
    
    opmlContent += `
            </body>
        </opml>`;
    
    // Create a Blob with the OPML content
    let opmlBlob = new Blob([opmlContent], {type: "text/xml"});
    
    // Create a download link
    let downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(opmlBlob);
    downloadLink.download = "feeds.opml";
    
    // Add the link to the document and click it
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    // Remove the link after triggering the download
    document.body.removeChild(downloadLink);
}

// Complete sudden scrolls for kindle mode
function scrollInternal(element, direction) {
  const scrollPadding = 40; // Don't scroll complete height, let user see some part of the next/prev page
  const targetDiv = document.getElementById(element.getAttribute("targetId"));
  targetDiv.scrollBy(0, (targetDiv.offsetHeight - scrollPadding) * direction);
}
function scrollInternalNext (element) {
  scrollInternal(element, 1);
}
function scrollInternalPrev (element) {
  scrollInternal(element, -1);
}
// Download read post urls list as backup
function downloadReadPosts() {
  let readPostUrls = localStorage.getItem('readPostUrls') || "[]";
  let readPostsBlob = new Blob([readPostUrls], {type: "text/plain"});
  let downloadLink = document.createElement("a");
  downloadLink.href = URL.createObjectURL(readPostsBlob);
  downloadLink.download = "readPostUrls.list.json";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}
// Upload read post urls list
function uploadReadPosts(overwrite) {
  let fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";
  fileInput.onchange = function() {
    let file = fileInput.files[0];
    let reader = new FileReader();
    reader.onload = function() {
        let readPostUrls = JSON.parse(localStorage.getItem('readPostUrls')) || [];
        let newReadPostUrls = JSON.parse(reader.result);
        if (overwrite) {
            readPostUrls = newReadPostUrls;
        } else {
            readPostUrls = Array.from(new Set(readPostUrls.concat(newReadPostUrls)));
        }
        localStorage.setItem('readPostUrls', JSON.stringify(readPostUrls));
        // Reload the page to update the read status
        location.reload();
    };
    reader.readAsText(file);
  };
  fileInput.click();
}
// Clear read post urls list
function clearReadPosts() {
  // Get confirmation from the user
  if (!confirm("Are you sure you want to clear all read posts? This action cannot be undone without a backup.")) {
    return;
  }
  localStorage.removeItem('readPostUrls');
  // Reload the page to update the read status
  location.reload();
}