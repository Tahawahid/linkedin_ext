let isAutomationRunning = false;
let currentPage = 1;
let maxPages = 40;

function extractJobs() {
  const jobs = [];

  const jobCards = document.querySelectorAll("li[data-occludable-job-id]");
  console.log(`Found ${jobCards.length} job cards on the page`);

  jobCards.forEach((card) => {
    try {
      const jobId = card.getAttribute("data-occludable-job-id");
      if (!jobId) return;
      const jobContainer = card.querySelector(".job-card-container");
      if (!jobContainer) return;

      const titleElement = card.querySelector(".job-card-list__title--link");
      const title =
        titleElement?.querySelector("strong")?.innerText?.trim() ||
        titleElement?.innerText?.trim() ||
        "N/A";

      const company =
        card
          .querySelector(".artdeco-entity-lockup__subtitle")
          ?.innerText?.trim() || "N/A";

      const location =
        card
          .querySelector(".job-card-container__metadata-wrapper li")
          ?.innerText?.trim() || "N/A";

      const link =
        card.querySelector(".job-card-list__title--link")?.href || "N/A";

      const footerItem = card.querySelector(".job-card-container__footer-item");
      const additionalInfo = footerItem ? footerItem.innerText.trim() : "N/A";

      const job = {
        id: jobId,
        title: title,
        company: company,
        location: location,
        link: link,
        additionalInfo: additionalInfo,
        page: currentPage,
      };

      jobs.push(job);
    } catch (error) {
      console.error("Error extracting job data:", error);
    }
  });

  return jobs;
}

function saveJobsToStorage(newJobs) {
  if (newJobs.length === 0) {
    console.log("No jobs to save");
    return;
  }

  chrome.storage.local.get(["jobs"], (result) => {
    const existingJobs = result.jobs || [];

    const existingIds = new Set(existingJobs.map((job) => job.id));
    const uniqueNewJobs = newJobs.filter((job) => !existingIds.has(job.id));

    const updatedJobs = [...existingJobs, ...uniqueNewJobs];
    chrome.storage.local.set({ jobs: updatedJobs }, () => {
      console.log(
        `Added ${uniqueNewJobs.length} new jobs to storage. Total: ${updatedJobs.length}`
      );

      chrome.runtime.sendMessage({
        action: "updateJobCount",
        count: updatedJobs.length,
      });
    });
  });
}

function scrollJobList() {
  return new Promise((resolve) => {
    const jobsList = document.querySelector(".jobs-search-results-list");

    if (!jobsList) {
      console.log("Jobs list container not found");
      resolve();
      return;
    }

    let lastHeight = jobsList.scrollHeight;
    let scrollAttempts = 0;
    const maxScrollAttempts = 10;

    const scrollInterval = setInterval(() => {
      jobsList.scrollTo(0, jobsList.scrollHeight);

      setTimeout(() => {
        const newHeight = jobsList.scrollHeight;
        scrollAttempts++;

        if (newHeight === lastHeight || scrollAttempts >= maxScrollAttempts) {
          clearInterval(scrollInterval);
          console.log(`Finished scrolling (${scrollAttempts} attempts)`);
          resolve();
        } else {
          lastHeight = newHeight;
        }
      }, 1000);
    }, 1500);
  });
}

function updatePaginationInfo() {
  try {
    const activePage = document.querySelector(
      ".artdeco-pagination__indicator--number.active"
    );
    if (activePage) {
      const pageBtn = activePage.querySelector(
        "[data-test-pagination-page-btn]"
      );
      if (pageBtn) {
        currentPage = parseInt(
          pageBtn.getAttribute("data-test-pagination-page-btn"),
          10
        );
      }
    }

    const pageState = document.querySelector(".artdeco-pagination__page-state");
    if (pageState) {
      const pageStateText = pageState.textContent.trim();
      const match = pageStateText.match(/Page \d+ of (\d+)/);
      if (match && match[1]) {
        maxPages = parseInt(match[1], 10);
      }
    }

    console.log(`Current page: ${currentPage}, Max pages: ${maxPages}`);
  } catch (error) {
    console.error("Error updating pagination info:", error);
  }
}

function goToNextPage() {
  try {
    const nextPageBtn = document.querySelector(
      `[data-test-pagination-page-btn="${currentPage + 1}"] button`
    );

    if (nextPageBtn) {
      console.log(`Navigating to page ${currentPage + 1}`);
      nextPageBtn.click();
      return true;
    } else {
      console.log("Next page button not found");
      return false;
    }
  } catch (error) {
    console.error("Error navigating to next page:", error);
    return false;
  }
}

function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
}

async function runAutomation() {
  if (!isAutomationRunning) return;

  try {
    updatePaginationInfo();

    console.log(`Processing page ${currentPage}...`);
    await scrollJobList();

    const jobs = extractJobs();
    if (jobs.length > 0) {
      saveJobsToStorage(jobs);
      console.log(`Extracted ${jobs.length} jobs from page ${currentPage}`);
    }

    if (isAutomationRunning && currentPage < maxPages) {
      const delay = getRandomDelay(5, 15);
      console.log(
        `Waiting ${delay / 1000} seconds before going to next page...`
      );

      setTimeout(() => {
        if (goToNextPage()) {
          setTimeout(runAutomation, 3000);
        } else {
          console.log("Failed to navigate to next page. Stopping automation.");
          isAutomationRunning = false;
          chrome.runtime.sendMessage({ action: "automationStopped" });
        }
      }, delay);
    } else {
      console.log("Reached the last page or automation stopped.");
      isAutomationRunning = false;
      chrome.runtime.sendMessage({ action: "automationStopped" });
    }
  } catch (error) {
    console.error("Error in automation:", error);
    isAutomationRunning = false;
    chrome.runtime.sendMessage({ action: "automationStopped" });
  }
}

function startAutomation() {
  if (isAutomationRunning) return;

  isAutomationRunning = true;
  console.log("Starting automation...");
  chrome.runtime.sendMessage({ action: "automationStarted" });

  runAutomation();
}

function stopAutomation() {
  isAutomationRunning = false;
  console.log("Stopping automation...");
  chrome.runtime.sendMessage({ action: "automationStopped" });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extractJobs") {
    const jobs = extractJobs();
    saveJobsToStorage(jobs);
    sendResponse({ success: true, count: jobs.length });
  } else if (message.action === "startAutomation") {
    startAutomation();
    sendResponse({ success: true });
  } else if (message.action === "stopAutomation") {
    stopAutomation();
    sendResponse({ success: true });
  } else if (message.action === "getStatus") {
    sendResponse({
      isRunning: isAutomationRunning,
      currentPage: currentPage,
      maxPages: maxPages,
    });
  }
  return true;
});

console.log("LinkedIn Job Extractor: Content script loaded");
setTimeout(() => {
  updatePaginationInfo();
  const initialJobs = extractJobs();
  if (initialJobs.length > 0) {
    saveJobsToStorage(initialJobs);
    console.log(`Extracted ${initialJobs.length} jobs from initial page load`);
  } else {
    console.log("No jobs found on initial page load");
  }
}, 5000);
