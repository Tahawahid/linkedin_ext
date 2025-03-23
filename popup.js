document.addEventListener("DOMContentLoaded", function () {
  const loadJobsButton = document.getElementById("loadJobs");
  const saveJobsButton = document.getElementById("saveJobs");
  const jobCountElement = document.getElementById("jobCount");
  const jobListElement = document.getElementById("jobList");

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
      </tr>
    `;
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement("tbody");
    jobs.forEach((job) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${job.title}</td>
        <td>${job.company}</td>
        <td>${job.location}</td>
      `;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    jobListElement.appendChild(table);
    saveJobsButton.disabled = false;
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

  // Check if there are already jobs in storage when the popup is opened
  chrome.storage.local.get(["jobs"], function (result) {
    const jobs = result.jobs || [];
    if (jobs.length > 0) {
      displayJobs(jobs);
    }
  });
});
