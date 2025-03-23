// Function to extract job data from the current page
function extractJobs() {
  const jobs = [];

  // Select all job list items
  const jobCards = document.querySelectorAll("li[data-occludable-job-id]");
  console.log(`Found ${jobCards.length} job cards on the page`);

  jobCards.forEach((card) => {
    try {
      const jobId = card.getAttribute("data-occludable-job-id");
      if (!jobId) return;

      // Find the job container within the card
      const jobContainer = card.querySelector(".job-card-container");
      if (!jobContainer) return;

      // Extract job title
      const titleElement = card.querySelector(".job-card-list__title--link");
      const title =
        titleElement?.querySelector("strong")?.innerText?.trim() ||
        titleElement?.innerText?.trim() ||
        "N/A";

      // Extract company name
      const company =
        card
          .querySelector(".artdeco-entity-lockup__subtitle")
          ?.innerText?.trim() || "N/A";

      // Extract location
      const location =
        card
          .querySelector(".job-card-container__metadata-wrapper li")
          ?.innerText?.trim() || "N/A";

      // Extract link
      const link =
        card.querySelector(".job-card-list__title--link")?.href || "N/A";

      // Extract additional info if available
      const footerItem = card.querySelector(".job-card-container__footer-item");
      const additionalInfo = footerItem ? footerItem.innerText.trim() : "N/A";

      const job = {
        id: jobId,
        title: title,
        company: company,
        location: location,
        link: link,
        additionalInfo: additionalInfo,
      };

      jobs.push(job);
      console.log(`Extracted job: ${title} at ${company}`);
    } catch (error) {
      console.error("Error extracting job data:", error);
    }
  });

  return jobs;
}

// Function to save jobs to chrome.storage.local
function saveJobsToStorage(newJobs) {
  if (newJobs.length === 0) {
    console.log("No jobs to save");
    return;
  }

  chrome.storage.local.get(["jobs"], (result) => {
    const existingJobs = result.jobs || [];

    // Filter out duplicates based on job ID
    const existingIds = new Set(existingJobs.map((job) => job.id));
    const uniqueNewJobs = newJobs.filter((job) => !existingIds.has(job.id));

    const updatedJobs = [...existingJobs, ...uniqueNewJobs];
    chrome.storage.local.set({ jobs: updatedJobs }, () => {
      console.log(
        `Added ${uniqueNewJobs.length} new jobs to storage. Total: ${updatedJobs.length}`
      );
    });
  });
}

// Function to manually trigger job extraction
function manualExtract() {
  console.log("Manual extraction triggered");
  const jobs = extractJobs();
  if (jobs.length > 0) {
    saveJobsToStorage(jobs);
    console.log(`Manually extracted ${jobs.length} jobs`);
  } else {
    console.log("No jobs found during manual extraction");
  }
}

// Extract jobs from the initial page load
console.log("LinkedIn Job Extractor: Content script loaded");
setTimeout(() => {
  const initialJobs = extractJobs();
  if (initialJobs.length > 0) {
    saveJobsToStorage(initialJobs);
    console.log(`Extracted ${initialJobs.length} jobs from initial page load`);
  } else {
    console.log("No jobs found on initial page load");
  }
}, 2000); // Wait 2 seconds for the page to fully load

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extractJobs") {
    manualExtract();
    sendResponse({ success: true });
  }
});

// Observe the jobs list for changes (e.g., when new jobs are loaded)
const observer = new MutationObserver((mutations) => {
  let shouldExtract = false;

  for (const mutation of mutations) {
    if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
      shouldExtract = true;
      break;
    }
  }

  if (shouldExtract) {
    console.log("DOM changes detected, extracting jobs");
    const newJobs = extractJobs();
    if (newJobs.length > 0) {
      saveJobsToStorage(newJobs);
    }
  }
});

// Start observing the jobs list container
// Try different possible container selectors
const possibleContainers = [
  ".jobs-search-results-list",
  ".scaffold-layout__list",
  "ul.wWyJsWGiVbcipleFlmnygUjvgjBqenBxXbso", // This is from your HTML
  ".jobs-search-results__list",
];

let observerStarted = false;

for (const selector of possibleContainers) {
  const container = document.querySelector(selector);
  if (container) {
    observer.observe(container, { childList: true, subtree: true });
    console.log(`Observer started on container: ${selector}`);
    observerStarted = true;
    break;
  }
}

if (!observerStarted) {
  console.log("No suitable jobs container found for observer");
}
