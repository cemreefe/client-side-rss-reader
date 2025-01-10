function isBlank(str) {
    return (!str || /^\s*$/.test(str));
}
function getCacheKey(url) {
  return `rss_cache_${btoa(url)}`;
}

function setCache(url, data) {
  const cacheKey = getCacheKey(url);
  const cachedData = {
    timestamp: Date.now(),
    data,
  };
  localStorage.setItem(cacheKey, JSON.stringify(cachedData));
}

function getCache(url, ttl) {
  const cacheKey = getCacheKey(url);
  const cachedData = localStorage.getItem(cacheKey);
  if (!cachedData) return null;

  const parsedData = JSON.parse(cachedData);
  if (Date.now() - parsedData.timestamp > ttl * 60 * 1000) {
    localStorage.removeItem(cacheKey);
    return null;
  }
  return parsedData.data;
}

// Starts the request, but only fetches until the size limit is reached, returns the partial or complete data
// If truncated response is returned, returns true truncated flag.
function fetchWithPartialResponse(url, maxResponseSizeKB) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const decoder = new TextDecoder("utf-8"); // TextDecoder to decode the stream into a string
    let accumulatedData = ''; // To store the concatenated string data
    
    // Make the request using Fetch API (which supports streams)
    fetch(url, { signal: controller.signal })
      .then((response) => {
        const reader = response.body.getReader(); // Read the stream of data

        let receivedBytes = 0;

        // Read the stream in chunks
        const readStream = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              // Stream finished, resolve with the accumulated data
              resolve({
                data: accumulatedData, // Return the accumulated XML data as string
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                config: {},
                request: {},
                truncated: false
              });
              return;
            }

            // Convert the chunk to a string and accumulate it
            accumulatedData += decoder.decode(value, { stream: true });

            receivedBytes += value.length;
            console.log(`Received ${receivedBytes} bytes`);

            if (receivedBytes >= maxResponseSizeKB * 1000) {
              // We've received maxResponseSizeKB*1000 bytes, abort the request
              controller.abort();
              resolve({
                data: accumulatedData, // Return the accumulated XML data
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                config: {},
                request: {},
                truncated: true
              });
            } else {
              // Continue reading if we haven't yet received the desired amount of data
              readStream();
            }
          }).catch(reject);
        };

        // Start reading the stream
        readStream();
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          console.log('Request aborted');
        }
        reject(error);
      });
  });
}

// Takes an incomplete rss or xml feed, removes broken tagsat the end and closes open tags.
function closeTruncatedFeed(feedData) {
  const tagRegex = /<\/?([^>]+?)(\/?>|( [^>]*)\/?>)/g;
  const cdataRegex = /<!\[CDATA\[.*?\]\]>/gs; // Matches CDATA sections

  // Step 1: Remove everything after the last </item>
  const lastItemIndex = feedData.lastIndexOf('</item>');
  const lastEntryIndex = feedData.lastIndexOf('</entry>');
  if (lastItemIndex !== -1) {
    feedData = feedData.substring(0, lastItemIndex + 7); // Keep up to the closing </item>
  } 
  else if (lastEntryIndex !== -1){
    // For Atom feeds, look for </entry>
    if (lastEntryIndex !== -1) {
      feedData = feedData.substring(0, lastEntryIndex + 8); // Keep up to the closing </entry>
    }
  }
  else {
    console.log("No complete items in current truncation level.");
    return;
  }

  // Remove CDATA tags for tag closing analysis. We'll close the tags on the original later on.
  let cdataLessFeed = feedData.replace(cdataRegex, '');

  // Stack to keep track of opened tags
  const openTags = [];
  let match;

  // Step 3: Process the remaining tags to track opened and closed ones
  while ((match = tagRegex.exec(cdataLessFeed)) !== null) {

    const tagName = match[1];
    const isClosingTag = cdataLessFeed[match.index + 1] === '/';
    const isSelfClosingTag = cdataLessFeed[match.index + match[0].length - 2] === '/';

    if (isClosingTag) {
      // If it's a closing tag, check if it matches the last opened tag
      if (openTags.length > 0 && openTags[openTags.length - 1] === tagName) {
        openTags.pop(); // Correctly close the last opened tag
      }
    } else if (!isSelfClosingTag) {
      // If it's an opening tag, push it to the stack
      openTags.push(tagName);
    }
  }

  // Step 4: Add closing tags for any remaining open tags
  openTags.reverse().forEach((tag) => {
    feedData += `</${tag}>`; // Add the missing closing tag at the end of the feed
  });

  // Step 5: Return the updated feed data
  return feedData;
}

new Vue({
  el: '#app',
  data: {
    rssInput: '',
    feeds: [],
    loading: false,
    loadingUrls: new Set(),
    error: null,
    currentPage: 1,
    pageSize: 10,
    cacheTTL: 0, // Default TTL in minutes
    responseTruncationLimitKB: 100, // Number response size after which feeds stop ingesting
    blocklist: '', // Default blocklist
    advancedSettingsVisible: false,
    expandAll: false,
  },
  computed: {
    paginatedFeeds() {
      const start = (this.currentPage - 1) * this.pageSize;
      return this.filteredFeeds.slice(start, start + this.pageSize);
    },
    filteredFeeds() {
      if (isBlank(this.blocklist)) {
        return this.sortedFeeds;
      }
      const blocks = this.blocklist.split(',').map(word => word.trim().toLowerCase());
      return this.sortedFeeds.filter(feed => {
        const content = `${feed.title} ${feed.content}`.toLowerCase();
        return !blocks.some(block => content.includes(block));
      });
    },
    sortedFeeds() {
      return this.feeds.sort((a, b) => {
        bDate = !!b.pubDate ? new Date(b.pubDate) : new Date(0);
        aDate = !!a.pubDate ? new Date(a.pubDate) : new Date(0);
        return bDate - aDate;
      });
    },
    totalPages() {
      return Math.ceil(this.filteredFeeds.length / this.pageSize);
    },
  },
  watch: {
    rssInput(newVal) {
      this.updateUrlParams(); // Perform actions when rssInput changes
    },
  },
  methods: {
    async fetchFeeds() {
      this.loading = true;
      this.loadingUrls = new Set();
      this.error = null;
      this.feeds = [];
      this.unfilteredFeeds = []; // Clear unfiltered results
      this.currentPage = 1;
      const parser = new RSSParser({
        customFields: {
          item: [
            ['media:content', 'mediaContent', {keepArray: true}],
            ['content:encoded', 'contentEncoded'],
          ]
        }
      });
      const urls = this.rssInput.split(',').map(url => url.trim());

      const fetchFeed = async (url) => {

        url = url.trim()
        if (!url) return;
        try {
          const cachedFeed = getCache(url, this.cacheTTL);
          if (cachedFeed) {
            console.log(`Using cached feed for ${url}`);
            this.unfilteredFeeds.push(...cachedFeed.items.map(item => ({
              title: item.title,
              link: item.link,
              pubDate: item.pubDate,
              content: item.content,
              contentEncoded: item.contentEncoded,
              feedTitle: cachedFeed.title,
              showDescription: false,
              mediaContent: item.mediaContent,
              mediaGroup: item.mediaGroup,
            })));
            console.log(this.unfilteredFeeds)
            console.log("Fetched feed items: " + this.unfilteredFeeds.length)
            this.updateFilteredFeeds(); // Update the filtered feeds whenever new data is added
            return;
          }

          this.loadingUrls.add(url)
          // Go over all proxies until a usable response is received.
          const proxies = [
            "https://api.allorigins.win/raw?url=",
            "https://corsproxy.io/?url=",
            "https://test.cors.workers.dev/?",
            "", // Oh hey, what if they _do_ allow CORS?
          ]
          let response = null;
          for (let i = 0; i < proxies.length; i++) {
            let proxy = proxies[i];
            const feedProxyUrl = `${proxy}${encodeURIComponent(url)}`;
            try {
              response = await fetchWithPartialResponse(feedProxyUrl, this.responseTruncationLimitKB);
              if (!!response && response.status == "200") {
                console.log(`Succeeded with proxy ${i} (${proxy}): ${url}`)
                break
              };
            }
            catch {}; // No-op, continue.
          } 
          this.loadingUrls.delete(url)
          
          if (!response || response.status != 200) {
            // Don't try to parse an error message from the req response.
            return;
          }

          const feed_text = response.truncated ? closeTruncatedFeed(response.data) : response.data;
          if (!feed_text) return;
          const feed = await parser.parseString(feed_text) ;
          setCache(url, feed);
          this.unfilteredFeeds.push(...feed.items.map(item => ({
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            content: item.content,
            contentEncoded: item.contentEncoded,
            feedTitle: feed.title,
            showDescription: false,
            mediaContent: item.mediaContent,
            mediaGroup: item.mediaGroup,
          })));
          console.log(this.unfilteredFeeds)
          console.log("Fetched feed items: " + this.unfilteredFeeds.length)
          this.updateFilteredFeeds(); // Update the filtered feeds as we go
        } catch (err) {
          console.error(`Failed to fetch feed from ${url}:`, err);
        }
      };

      // Fetch all feeds asynchronously but render progressively
      const feedPromises = urls.map(url => fetchFeed(url));

      // Wait for all feed fetches to finish
      await Promise.all(feedPromises);

      this.loading = false; // Set loading to false after all feeds have been processed
    },
    updateFilteredFeeds() {
      const blocks = isBlank(this.blocklist) ? [] : this.blocklist.split(',').map(word => word.trim().toLowerCase());
      this.feeds = this.unfilteredFeeds.filter(feed => {
        const content = `${feed.title} ${feed.content}`.toLowerCase();
        return !blocks.some(block => content.includes(block));
      });
    },
    showDescription(item) {
      this.feeds = this.feeds.map(feedItem => ({
        ...feedItem,
        showDescription: feedItem === item ? !feedItem.showDescription : feedItem.showDescription,
      }));
    },
    closeDescription(item) {
      item.showDescription = false;
    },
    expandAllToggle() {
      this.expandAll = !this.expandAll;
      this.feeds = this.feeds.map(feedItem => ({
        ...feedItem,
        showDescription: this.expandAll,
      }));
    },
    formatDate(dateString) {
      const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    },
    loadFeedsFromQuery() {
      const urlParams = new URLSearchParams(window.location.search);
      const feeds = urlParams.get('feeds');
      if (feeds) {
        this.rssInput = feeds.split(',').join(', ');
        this.cacheTTL = Number(urlParams.get('ttl')) || this.cacheTTL;
        this.blocklist = urlParams.get('blocklist') || this.blocklist;
        this.responseTruncationLimitKB = Number(urlParams.get('truncLim')) || this.responseTruncationLimitKB;
        this.fetchFeeds();
      }
    },
    invalidateCache() {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('rss_cache_')) {
          localStorage.removeItem(key);
        }
      });
      alert('Cache invalidated.');
    },
    toggleAdvancedSettings() {
      this.advancedSettingsVisible = !this.advancedSettingsVisible;
      document.getElementById('advanced-settings').style.display = this.advancedSettingsVisible ? 'block' : 'none';
    },
    updateUrlParams() {
      const queryParams = { 
        feeds: this.rssInput.split(',').map(url => url.trim()), 
        ttl: this.cacheTTL, 
        blocklist: this.blocklist, 
        truncLim: this.responseTruncationLimitKB
      };
      const queryString = new URLSearchParams(queryParams).toString();
      history.replaceState(null, null, `?${queryString}`);
    },
    handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) {
        alert("Please select a file.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        let opmlContent = e.target.result;
        // Preprocessing hacks for improper OPML files
        opmlContent = opmlContent.replaceAll(" & ", " &amp; ")
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(opmlContent, "application/xml");

          const parseError = xmlDoc.querySelector("parsererror");
          if (parseError) {
            console.log(parseError);
            throw new Error("Error parsing OPML file.");
          }

          const outlines = xmlDoc.querySelectorAll("outline");
          const xmlUrls = Array.from(outlines)
            .map(outline => outline.getAttribute("xmlUrl"))
            .filter(url => url !== null);

          this.rssInput = xmlUrls.join(", ");
          this.fetchFeeds()
        } catch (error) {
          alert("Failed to parse OPML file: " + error.message);
          console.log(error);
        }
      };
      reader.onerror = () => {
        alert("Error reading file.");
      }
      reader.readAsText(file)
    }
  },
  mounted() {
    this.loadFeedsFromQuery();
  },
});
