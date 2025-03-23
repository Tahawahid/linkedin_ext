document.addEventListener("DOMContentLoaded", function () {
  const loadJobsButton = document.getElementById("loadJobs");
  const saveJobsButton = document.getElementById("saveJobs");
  const startAutomationButton = document.getElementById("startAutomation");
  const stopAutomationButton = document.getElementById("stopAutomation");
  const jobCountElement = document.getElementById("jobCount");
  const automationStatusElement = document.getElementById("automationStatus");
  const jobListElement = document.getElementById("jobList");

  let isAutomationRunning = false;

  function updateAutomationUI(isRunning) {
    isAutomationRunning = isRunning;

    if (isRunning) {
      startAutomationButton.disabled = true;
      stopAutomationButton.disabled = false;
      automationStatusElement.textContent = "Automation: Running";
      automationStatusElement.className =
        "status-bar automation-status-running";
    } else {
      startAutomationButton.disabled = false;
      stopAutomationButton.disabled = true;
      automationStatusElement.textContent = "Automation: Stopped";
      automationStatusElement.className =
        "status-bar automation-status-stopped";
    }
  }
  function displayJobs(jobs) {
    jobCountElement.textContent = `Jobs extracted: ${jobs.length}`;

    jobListElement.innerHTML = "";

    if (jobs.length === 0) {
      jobListElement.innerHTML =
        '<div class="no-jobs">No jobs found. Navigate to LinkedIn Jobs page and try again.</div>';
      return;
    }

    const table = document.createElement("table");
    table.className = "job-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th>Title</th>
        <th>Company</th>
        <th>Location</th>
        <th>Page</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    jobs.forEach((job) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${job.title}</td>
        <td>${job.company}</td>
        <td>${job.location}</td>
        <td>${job.page || "N/A"}</td>
      `;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    jobListElement.appendChild(table);
    saveJobsButton.disabled = false;
  }

  function isLinkedInJobsPage(url) {
    return (
      url.includes("linkedin.com/jobs") ||
      url.includes("linkedin.com/feed/jobs") ||
      url.includes("linkedin.com/my-items/saved-jobs")
    );
  }

  function checkAutomationStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs[0];

      if (isLinkedInJobsPage(currentTab.url)) {
        chrome.tabs.sendMessage(
          currentTab.id,
          { action: "getStatus" },
          function (response) {
            if (response && response.isRunning !== undefined) {
              updateAutomationUI(response.isRunning);

              if (response.isRunning) {
                automationStatusElement.textContent = `Automation: Running (Page ${response.currentPage} of ${response.maxPages})`;
              }
            }
          }
        );
      }
    });
  }

  loadJobsButton.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs[0];

      if (isLinkedInJobsPage(currentTab.url)) {
        chrome.tabs.sendMessage(
          currentTab.id,
          { action: "extractJobs" },
          function (response) {
            setTimeout(() => {
              chrome.storage.local.get(["jobs"], function (result) {
                const jobs = result.jobs || [];
                displayJobs(jobs);
              });
            }, 500);
          }
        );
      } else {
        jobListElement.innerHTML =
          '<div class="alert alert-warning">Please navigate to a LinkedIn Jobs page first.</div>';
      }
    });
  });

  saveJobsButton.addEventListener("click", function () {
    chrome.storage.local.get(["jobs"], function (result) {
      const jobs = result.jobs || [];

      if (jobs.length === 0) {
        return;
      }

      const blob = new Blob([JSON.stringify(jobs, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "linkedin_jobs.json";
      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  });

  startAutomationButton.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs[0];

      if (isLinkedInJobsPage(currentTab.url)) {
        chrome.tabs.sendMessage(
          currentTab.id,
          { action: "startAutomation" },
          function (response) {
            if (response && response.success) {
              updateAutomationUI(true);
            }
          }
        );
      } else {
        jobListElement.innerHTML =
          '<div class="alert alert-warning">Please navigate to a LinkedIn Jobs page first.</div>';
      }
    });
  });

  stopAutomationButton.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs[0];

      if (isLinkedInJobsPage(currentTab.url)) {
        chrome.tabs.sendMessage(
          currentTab.id,
          { action: "stopAutomation" },
          function (response) {
            if (response && response.success) {
              updateAutomationUI(false);
            }
          }
        );
      }
    });
  });

  chrome.runtime.onMessage.addListener(function (
    message,
    sender,
    sendResponse
  ) {
    if (message.action === "automationStarted") {
      updateAutomationUI(true);
    } else if (message.action === "automationStopped") {
      updateAutomationUI(false);
    } else if (message.action === "updateJobCount") {
      jobCountElement.textContent = `Jobs extracted: ${message.count}`;

      if (!jobListElement.querySelector(".no-jobs")) {
        chrome.storage.local.get(["jobs"], function (result) {
          const jobs = result.jobs || [];
          displayJobs(jobs);
        });
      }
    }
  });

  chrome.storage.local.get(["jobs"], function (result) {
    const jobs = result.jobs || [];
    if (jobs.length > 0) {
      displayJobs(jobs);
    }
  });

  checkAutomationStatus();
});
