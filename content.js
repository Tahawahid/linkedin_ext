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

// Function to extract job details from the current job details page
function extractJobDetails() {
  try {
    // Check if we're on a job details page
    const jobDetailsContainer = document.querySelector(
      ".jobs-details__main-content"
    );

    if (!jobDetailsContainer) {
      console.log("No job details container found on this page");
      return null;
    }

    // Get the job ID from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const jobId =
      urlParams.get("currentJobId") ||
      window.location.pathname.split("/").pop().replace(/\D/g, "");

    if (!jobId) {
      console.log("Could not extract job ID from URL");
      return null;
    }

    // Extract basic job information for reference
    const jobTitle =
      document
        .querySelector(".job-details-jobs-unified-top-card__job-title")
        ?.innerText.trim() || "N/A";
    const companyName =
      document
        .querySelector(".job-details-jobs-unified-top-card__company-name")
        ?.innerText.trim() || "N/A";
    const location =
      document
        .querySelector(".job-details-jobs-unified-top-card__bullet")
        ?.innerText.trim() || "N/A";

    // Get the entire HTML content of the job details section
    const detailsHTML = jobDetailsContainer.outerHTML;

    const jobDetails = {
      id: jobId,
      title: jobTitle,
      company: companyName,
      location: location,
      detailsHTML: detailsHTML,
      extractedAt: new Date().toISOString(),
    };

    console.log(`Extracted details for job: ${jobTitle} at ${companyName}`);

    // Save the job details to storage
    saveJobDetailsToStorage(jobDetails);

    return jobDetails;
  } catch (error) {
    console.error("Error extracting job details:", error);
    return null;
  }
}

// Function to save job details to chrome.storage.local
function saveJobDetailsToStorage(jobDetails) {
  if (!jobDetails || !jobDetails.id) {
    console.log("No valid job details to save");
    return;
  }

  chrome.storage.local.get(["jobDetails"], (result) => {
    const existingDetails = result.jobDetails || {};

    // Add or update the job details using the job ID as the key
    existingDetails[jobDetails.id] = jobDetails;

    chrome.storage.local.set({ jobDetails: existingDetails }, () => {
      console.log(`Saved details for job ID: ${jobDetails.id}`);
    });
  });
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

  // Check if we're on a job details page first
  const jobDetailsContainer = document.querySelector(
    ".jobs-details__main-content"
  );

  if (jobDetailsContainer) {
    // We're on a job details page, extract the details
    const details = extractJobDetails();
    if (details) {
      console.log("Successfully extracted job details");
      return { success: true, type: "details" };
    }
  } else {
    // We're on a job listings page, extract the jobs
    const jobs = extractJobs();
    if (jobs.length > 0) {
      saveJobsToStorage(jobs);
      console.log(`Manually extracted ${jobs.length} jobs`);
      return { success: true, type: "listings" };
    } else {
      console.log("No jobs found during manual extraction");
    }
  }

  return { success: false };
}

// Extract jobs from the initial page load
console.log("LinkedIn Job Extractor: Content script loaded");
setTimeout(() => {
  // Check if we're on a job details page
  const jobDetailsContainer = document.querySelector(
    ".jobs-details__main-content"
  );

  if (jobDetailsContainer) {
    // We're on a job details page, extract the details
    extractJobDetails();
  } else {
    // We're on a job listings page, extract the jobs
    const initialJobs = extractJobs();
    if (initialJobs.length > 0) {
      saveJobsToStorage(initialJobs);
      console.log(
        `Extracted ${initialJobs.length} jobs from initial page load`
      );
    } else {
      console.log("No jobs found on initial page load");
    }
  }
}, 2000); // Wait 2 seconds for the page to fully load

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extractJobs") {
    const result = manualExtract();
    sendResponse(result);
  }
  return true;
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
