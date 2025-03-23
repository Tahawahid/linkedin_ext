document.addEventListener("DOMContentLoaded", function () {
  const loadJobsButton = document.getElementById("loadJobs");
  const saveJobsButton = document.getElementById("saveJobs");
  const jobCountElement = document.getElementById("jobCount");
  const jobListElement = document.getElementById("jobList");
  const listingsTab = document.getElementById("listingsTab");
  const detailsTab = document.getElementById("detailsTab");
  const listingsPanel = document.getElementById("listingsPanel");
  const detailsPanel = document.getElementById("detailsPanel");
  const extractDetailsButton = document.getElementById("extractDetails");
  const saveDetailsButton = document.getElementById("saveDetails");
  const detailsCountElement = document.getElementById("detailsCount");
  const jobDetailsListElement = document.getElementById("jobDetailsList");

  // Add missing details count element
  const missingDetailsCountElement = document.createElement("div");
  missingDetailsCountElement.id = "missingDetailsCount";
  missingDetailsCountElement.className = "status-bar status-bar-warning";
  missingDetailsCountElement.textContent = "Missing job details: 0";
  jobCountElement.parentNode.insertBefore(
    missingDetailsCountElement,
    jobCountElement.nextSibling
  );

  // Function to switch between tabs
  function switchTab(tabName) {
    if (tabName === "listings") {
      listingsTab.classList.add("active");
      detailsTab.classList.remove("active");
      listingsPanel.classList.add("active");
      detailsPanel.classList.remove("active");
    } else {
      listingsTab.classList.remove("active");
      detailsTab.classList.add("active");
      listingsPanel.classList.remove("active");
      detailsPanel.classList.add("active");
    }
  }

  // Tab click handlers
  listingsTab.addEventListener("click", () => switchTab("listings"));
  detailsTab.addEventListener("click", () => switchTab("details"));

  // Function to count missing job details
  function countMissingJobDetails(jobs, jobDetails) {
    const jobDetailsIds = Object.keys(jobDetails || {});
    const missingCount = jobs.filter(
      (job) => !jobDetailsIds.includes(job.id)
    ).length;
    return missingCount;
  }

  // Function to update missing details count
  function updateMissingDetailsCount() {
    chrome.storage.local.get(["jobs", "jobDetails"], function (result) {
      const jobs = result.jobs || [];
      const jobDetails = result.jobDetails || {};
      const missingCount = countMissingJobDetails(jobs, jobDetails);

      missingDetailsCountElement.textContent = `Missing job details: ${missingCount}`;

      if (missingCount > 0) {
        missingDetailsCountElement.classList.add("status-bar-warning");
      } else {
        missingDetailsCountElement.classList.remove("status-bar-warning");
      }
    });
  }

  function updateProgressBar() {
    chrome.storage.local.get(["jobs", "jobDetails"], function (result) {
      const jobs = result.jobs || [];
      const jobDetails = result.jobDetails || {};

      if (jobs.length === 0) return;

      const totalJobs = jobs.length;
      const extractedDetails = Object.keys(jobDetails).length;
      const percentage = Math.round((extractedDetails / totalJobs) * 100);

      // Create or update progress container
      let progressContainer = document.getElementById("progressContainer");
      if (!progressContainer) {
        progressContainer = document.createElement("div");
        progressContainer.id = "progressContainer";
        progressContainer.className = "progress-container";

        const progressBar = document.createElement("div");
        progressBar.id = "progressBar";
        progressBar.className = "progress-bar";

        const progressText = document.createElement("div");
        progressText.id = "progressText";
        progressText.className = "progress-text";

        progressContainer.appendChild(progressBar);
        progressContainer.appendChild(progressText);

        // Insert after missing details count
        const missingDetailsCount = document.getElementById(
          "missingDetailsCount"
        );
        missingDetailsCount.parentNode.insertBefore(
          progressContainer,
          missingDetailsCount.nextSibling
        );
      }

      // Update progress bar and text
      const progressBar = document.getElementById("progressBar");
      const progressText = document.getElementById("progressText");

      progressBar.style.width = `${percentage}%`;
      progressText.textContent = `${extractedDetails} of ${totalJobs} jobs (${percentage}%)`;
    });
  }

  // Function to navigate to the next job with missing details
  function addMissingDetailsNavigation() {
    chrome.storage.local.get(["jobs", "jobDetails"], function (result) {
      const jobs = result.jobs || [];
      const jobDetails = result.jobDetails || {};
      const jobDetailsIds = Object.keys(jobDetails);

      // Find jobs with missing details
      const missingJobs = jobs.filter((job) => !jobDetailsIds.includes(job.id));

      if (missingJobs.length === 0) return;

      // Create navigation container if it doesn't exist
      let navContainer = document.getElementById("missingDetailsNav");
      if (!navContainer) {
        navContainer = document.createElement("div");
        navContainer.id = "missingDetailsNav";
        navContainer.className = "missing-details-nav";

        const navButton = document.createElement("button");
        navButton.id = "navToMissingButton";
        navButton.textContent = `Navigate to Next Missing Job (${missingJobs.length} remaining)`;

        navButton.addEventListener("click", function () {
          // Get the first job with missing details and open its link
          if (
            missingJobs.length > 0 &&
            missingJobs[0].link &&
            missingJobs[0].link !== "N/A"
          ) {
            chrome.tabs.create({ url: missingJobs[0].link });
          }
        });

        navContainer.appendChild(navButton);

        // Insert after progress container
        const progressContainer = document.getElementById("progressContainer");
        if (progressContainer) {
          progressContainer.parentNode.insertBefore(
            navContainer,
            progressContainer.nextSibling
          );
        } else {
          // Fallback if progress container doesn't exist
          const missingDetailsCount = document.getElementById(
            "missingDetailsCount"
          );
          missingDetailsCount.parentNode.insertBefore(
            navContainer,
            missingDetailsCount.nextSibling
          );
        }
      } else {
        // Update existing button
        const navButton = document.getElementById("navToMissingButton");
        navButton.textContent = `Navigate to Next Missing Job (${missingJobs.length} remaining)`;
        navButton.disabled = missingJobs.length === 0;
      }
    });
  }
  // Function to display jobs in the popup
  function displayJobs(jobs) {
    jobCountElement.textContent = `Jobs extracted: ${jobs.length}`;

    // Clear previous job list
    jobListElement.innerHTML = "";

    if (jobs.length === 0) {
      jobListElement.innerHTML =
        '<div class="no-jobs">No jobs found. Navigate to LinkedIn Jobs page and try again.</div>';
      return;
    }

    // Create a table to display jobs
    const table = document.createElement("table");
    table.className = "job-table";

    // Create table header
    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th>Title</th>
        <th>Company</th>
        <th>Location</th>
        <th>Details</th>
      </tr>
    `;
    table.appendChild(thead);

    // Get job details to check which jobs have details extracted
    chrome.storage.local.get(["jobDetails"], function (result) {
      const jobDetails = result.jobDetails || {};
      const jobDetailsIds = Object.keys(jobDetails);

      // Create table body
      const tbody = document.createElement("tbody");
      jobs.forEach((job) => {
        const hasDetails = jobDetailsIds.includes(job.id);
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${job.title}</td>
          <td>${job.company}</td>
          <td>${job.location}</td>
          <td>
            ${
              hasDetails
                ? '<span class="details-status details-extracted">✓</span>'
                : '<span class="details-status details-missing">✗</span>'
            }
          </td>
        `;

        // Add class to rows with missing details
        if (!hasDetails) {
          row.classList.add("missing-details");
        }

        // Add click handler to open job link
        row.addEventListener("click", function () {
          if (job.link && job.link !== "N/A") {
            chrome.tabs.create({ url: job.link });
          }
        });

        tbody.appendChild(row);
      });
      table.appendChild(tbody);

      jobListElement.appendChild(table);
      saveJobsButton.disabled = false;

      // Update missing details count
      updateMissingDetailsCount();
      updateProgressBar();
      addMissingDetailsNavigation();
    });
  }

  // Function to display job details
  function displayJobDetails(jobDetails) {
    const detailsArray = Object.values(jobDetails);
    detailsCountElement.textContent = `Job details extracted: ${detailsArray.length}`;

    // Clear previous job details list
    jobDetailsListElement.innerHTML = "";

    if (detailsArray.length === 0) {
      jobDetailsListElement.innerHTML =
        '<div class="no-jobs">No job details found. Navigate to a LinkedIn Job detail page and click "Extract Current Job Details".</div>';
      return;
    }

    // Sort details by extraction date (newest first)
    detailsArray.sort(
      (a, b) => new Date(b.extractedAt) - new Date(a.extractedAt)
    );

    // Create a container for job details cards
    const detailsContainer = document.createElement("div");
    detailsContainer.className = "job-details-container";

    detailsArray.forEach((detail) => {
      const detailCard = document.createElement("div");
      detailCard.className = "job-detail-card";

      const benefitsList =
        detail.benefits && detail.benefits.length > 0
          ? `<ul>${detail.benefits
              .map((benefit) => `<li>${benefit}</li>`)
              .join("")}</ul>`
          : "None listed";

      detailCard.innerHTML = `
        <h3>${detail.title}</h3>
        <div class="detail-company">${detail.company}</div>
        <div class="detail-location">${detail.location}</div>
        <div class="detail-type">
          <span class="detail-badge">${detail.jobType}</span>
          <span class="detail-badge">${detail.jobStatus}</span>
        </div>
        <div class="detail-section">
          <h4>Benefits:</h4>
          ${benefitsList}
        </div>
        <div class="detail-footer">
          <span class="detail-date">Extracted: ${new Date(
            detail.extractedAt
          ).toLocaleString()}</span>
          <button class="view-description-btn" data-id="${
            detail.id
          }">View Description</button>
        </div>
      `;

      // Add click handler for view description button
      const viewDescBtn = detailCard.querySelector(".view-description-btn");
      viewDescBtn.addEventListener("click", function () {
        const modal = document.createElement("div");
        modal.className = "modal";
        modal.innerHTML = `
          <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h3>${detail.title} - Description</h3>
            <div class="description-content">${detail.description.replace(
              /\n/g,
              "<br>"
            )}</div>
          </div>
        `;
        document.body.appendChild(modal);

        // Close modal handler
        modal
          .querySelector(".close-modal")
          .addEventListener("click", function () {
            document.body.removeChild(modal);
          });
      });

      detailsContainer.appendChild(detailCard);
    });

    jobDetailsListElement.appendChild(detailsContainer);
    saveDetailsButton.disabled = false;
  }

  // Function to check if current tab is a LinkedIn jobs page
  function isLinkedInJobsPage(url) {
    return (
      url.includes("linkedin.com/jobs") ||
      url.includes("linkedin.com/feed/jobs") ||
      url.includes("linkedin.com/my-items/saved-jobs")
    );
  }

  // Load jobs from storage when the "Load Jobs" button is clicked
  loadJobsButton.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs[0];

      // Check if we're on a LinkedIn jobs page
      if (isLinkedInJobsPage(currentTab.url)) {
        // First, try to trigger a manual extraction in the content script
        chrome.tabs.sendMessage(
          currentTab.id,
          { action: "extractJobs" },
          function (response) {
            // After extraction (or if it fails), get jobs from storage
            setTimeout(() => {
              chrome.storage.local.get(["jobs"], function (result) {
                const jobs = result.jobs || [];
                displayJobs(jobs);
              });
            }, 500); // Wait a bit for storage to update
          }
        );
      } else {
        jobListElement.innerHTML =
          '<div class="alert alert-warning">Please navigate to a LinkedIn Jobs page first.</div>';
      }
    });
  });

  // Extract job details when the "Extract Current Job Details" button is clicked
  extractDetailsButton.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs[0];

      // Check if we're on a LinkedIn page
      if (currentTab.url.includes("linkedin.com")) {
        chrome.tabs.sendMessage(
          currentTab.id,
          { action: "extractJobs" },
          function (response) {
            if (response && response.type === "details") {
              // Refresh the job details display
              chrome.storage.local.get(["jobDetails"], function (result) {
                const jobDetails = result.jobDetails || {};
                displayJobDetails(jobDetails);
                updateMissingDetailsCount();
                updateProgressBar();
                addMissingDetailsNavigation();
              });
            } else {
              jobDetailsListElement.innerHTML =
                '<div class="alert alert-warning">Please navigate to a LinkedIn Job details page first.</div>';
            }
          }
        );
      } else {
        jobDetailsListElement.innerHTML =
          '<div class="alert alert-warning">Please navigate to a LinkedIn page first.</div>';
      }
    });
  });

  // Save jobs as JSON when the "Save Jobs" button is clicked
  saveJobsButton.addEventListener("click", function () {
    chrome.storage.local.get(["jobs"], function (result) {
      const jobs = result.jobs || [];

      if (jobs.length === 0) {
        return;
      }

      // Create a blob with the JSON data
      const blob = new Blob([JSON.stringify(jobs, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);

      // Create a link to download the JSON file
      const a = document.createElement("a");
      a.href = url;
      a.download = "linkedin_jobs.json";
      document.body.appendChild(a);
      a.click();

      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  });

  // Save job details as JSON when the "Save Details" button is clicked
  saveDetailsButton.addEventListener("click", function () {
    chrome.storage.local.get(["jobDetails"], function (result) {
      const jobDetails = result.jobDetails || {};
      const detailsArray = Object.values(jobDetails);

      if (detailsArray.length === 0) {
        return;
      }

      // Create a blob with the JSON data
      const blob = new Blob([JSON.stringify(detailsArray, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);

      // Create a link to download the JSON file
      const a = document.createElement("a");
      a.href = url;
      a.download = "linkedin_job_details.json";
      document.body.appendChild(a);
      a.click();

      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  });

  // Add a button to show only jobs with missing details
  const filterMissingButton = document.createElement("button");
  filterMissingButton.id = "filterMissing";
  filterMissingButton.className = "filter-btn";
  filterMissingButton.textContent = "Show Missing Details Only";
  jobListElement.parentNode.insertBefore(filterMissingButton, jobListElement);

  let showingMissingOnly = false;
  filterMissingButton.addEventListener("click", function () {
    chrome.storage.local.get(["jobs", "jobDetails"], function (result) {
      const jobs = result.jobs || [];
      const jobDetails = result.jobDetails || {};
      const jobDetailsIds = Object.keys(jobDetails);

      if (!showingMissingOnly) {
        // Filter to show only jobs with missing details
        const missingJobs = jobs.filter(
          (job) => !jobDetailsIds.includes(job.id)
        );
        displayJobs(missingJobs);
        filterMissingButton.textContent = "Show All Jobs";
        showingMissingOnly = true;
      } else {
        // Show all jobs
        displayJobs(jobs);
        filterMissingButton.textContent = "Show Missing Details Only";
        showingMissingOnly = false;
      }
    });
  });

  // Check if there are already jobs in storage when the popup is opened
  chrome.storage.local.get(["jobs", "jobDetails"], function (result) {
    const jobs = result.jobs || [];
    const jobDetails = result.jobDetails || {};

    if (jobs.length > 0) {
      displayJobs(jobs);
    }

    if (Object.keys(jobDetails).length > 0) {
      displayJobDetails(jobDetails);
    }

    // Update missing details count and progress
    updateMissingDetailsCount();
    updateProgressBar();
    addMissingDetailsNavigation();
  });
});
