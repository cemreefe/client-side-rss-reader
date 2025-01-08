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

// function axiosGetWithPartialResponse(url, config = {}) {
//   const controller = new AbortController();

//   // Ensure we have the abort signal in the config
//   const axiosConfig = {
//     ...config,
//     signal: controller.signal,
//     onDownloadProgress: (progressEvent) => {
//       console.log(progressEvent)
//       const bytesReceived = progressEvent.loaded;
//       if (bytesReceived >= 100000) {
//         console.log('Received 100 bytes, aborting request');
//         controller.abort();  // Abort the request after receiving 100 bytes
//       }
//     },
//   };

//   // Return a promise that handles the request and response
//   return axios
//     .get(url, axiosConfig)
//     .then((response) => {
//       // If the request is successful (without being aborted)
//       return response.data;
//     })
//     .catch((error) => {
//       // Handle the case when the request is aborted or any other error
//       if (axios.isCancel(error)) {
//         // Request was aborted
//         console.log('Request aborted');
//         const partialResponse = error.response ? error.response.data : null;
//         console.log(error);
//         console.log(error.response);
//         console.log(partialResponse);
//         return partialResponse.data; // Return the partial data
//       } else {
//         // Handle other errors
//         console.error('Error:', error);
//         throw error;
//       }
//     });
// }

// function axiosGetWithPartialResponse(url, config = {}) {
//   return new Promise((resolve, reject) => {
//     const xhr = new XMLHttpRequest();
//     const controller = new AbortController();
    
//     // Set up the request configuration
//     xhr.open('GET', url, true);
//     xhr.responseType = 'arraybuffer'; // or 'blob'
//     xhr.signal = controller.signal;
    
//     // Track the download progress
//     xhr.onprogress = function (event) {
//       if (event.loaded >= 100) {
//         console.log('Received 100 bytes, aborting request');
//         controller.abort();  // Abort the request after receiving 100 bytes
//       }
//     };
    
//     // Handle successful response
//     xhr.onload = function () {
//       if (xhr.status === 200) {
//         resolve(xhr.response.data);
//       } else {
//         reject(new Error('Request failed with status ' + xhr.status));
//       }
//     };
    
//     // Handle aborted request or any errors
//     xhr.onerror = function () {
//       reject(new Error('Request failed'));
//     };
    
//     xhr.onabort = function () {
//       console.log('Request aborted');
//       resolve(xhr.response.data);
//     };
    
//     // Send the request
//     xhr.send();
//   });
// }

function axiosGetWithPartialResponse(url) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const decoder = new TextDecoder("utf-8"); // TextDecoder to decode the stream into a string
    let accumulatedData = ''; // To store the concatenated string data
    
    // Make the request using Fetch API (which supports streams)
    fetch(url, { signal: controller.signal })
      .then((response) => {
        const reader = response.body.getReader(); // Read the stream of data

        let receivedBytes = 0;
        let partialData = new Uint8Array(100000); // Pre-allocate space for data

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

            if (receivedBytes >= 100000) {
              // We've received 100,000 bytes, abort the request
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



new Vue({
  el: '#app',
  data: {
    rssInput: '',
    feeds: [],
    loading: false,
    error: null,
    currentPage: 1,
    pageSize: 10,
    cacheTTL: 30, // Default TTL in minutes
    blocklist: '', // Default blocklist
    advancedSettingsVisible: false,
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
      return this.feeds.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    },
    totalPages() {
      return Math.ceil(this.filteredFeeds.length / this.pageSize);
    },
  },
  methods: {
    async fetchFeeds() {
      this.loading = true;
      this.error = null;
      this.feeds = [];
      this.unfilteredFeeds = []; // Clear unfiltered results
      const parser = new RSSParser({
        customFields: {
          item: [
            ['media:content', 'mediaContent', {keepArray: true}],
          ]
        }
      });
      const urls = this.rssInput.split(',').map(url => url.trim());

      const fetchFeed = async (url) => {
        try {
          const cachedFeed = getCache(url, this.cacheTTL);
          if (cachedFeed) {
            console.log(`Using cached feed for ${url}`);
            this.unfilteredFeeds.push(...cachedFeed.items.map(item => ({
              title: item.title,
              link: item.link,
              pubDate: item.pubDate,
              content: item.content,
              feedTitle: cachedFeed.title,
              showDescription: false,
              mediaContent: item.mediaContent,
            })));
            console.log(this.unfilteredFeeds)
            this.updateFilteredFeeds(); // Update the filtered feeds whenever new data is added
            return;
          }

          const response, truncated = await axiosGetWithPartialResponse(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
          console.log("responseresponseresponseresponse");
          console.log(response);
          const feed = await parser.parseString(response.data);
          setCache(url, feed);
          console.log("Feed");
          console.log(feed)

          this.unfilteredFeeds.push(...feed.items.map(item => ({
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            content: item.content,
            feedTitle: feed.title,
            showDescription: false,
            mediaContent: item.mediaContent,
          })));
          console.log(this.unfilteredFeeds)
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
      const queryParams = { feeds: this.rssInput.split(',').map(url => url.trim()), ttl: this.cacheTTL, blocklist: this.blocklist };
      const queryString = new URLSearchParams(queryParams).toString();
      history.replaceState(null, null, `?${queryString}`);
    },
  },
  mounted() {
    this.loadFeedsFromQuery();
  },
});