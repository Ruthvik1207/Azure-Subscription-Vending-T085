// ======================================================
// ELEMENTS
// ======================================================

const requestForm =
    document.getElementById("requestForm");

const submitButton =
    requestForm?.querySelector('button[type="submit"]');

const resultBox =
    document.getElementById("result");

const requesterInput =
    document.getElementById("requester");

const projectCodeInput =
    document.getElementById("projectCode");

const environmentInput =
    document.getElementById("environment");

const regionInput =
    document.getElementById("region");

const ownerInput =
    document.getElementById("owner");

const resourceStatus =
    document.getElementById("resourceStatus");

const resourcesContainer =
    document.getElementById("resourcesContainer");

const connectionStatus =
    document.getElementById("connectionStatus");


// ======================================================
// SCROLL TO REQUEST
// ======================================================

function scrollToRequest() {

    const section =
        document.getElementById(
            "request-section"
        );

    section.scrollIntoView({
        behavior: "smooth"
    });

}


// Make available to inline HTML onclick
window.scrollToRequest =
    scrollToRequest;


// ======================================================
// DISPLAY RESULT
// ======================================================

function showResult(
    status,
    message
) {

    const statusClass = [
        "approved",
        "exception",
        "rejected",
        "error",
        "processing"
    ].includes(String(status).toLowerCase())
        ? String(status).toLowerCase()
        : "unknown";

    const needsAttention = [
        "exception",
        "rejected",
        "error"
    ].includes(statusClass);

    resultBox.classList.remove(
        "hidden",
        "approved",
        "exception",
        "rejected",
        "error",
        "processing",
        "unknown",
        "has-problem"
    );

    resultBox.classList.add(statusClass);

    if (needsAttention) {
        resultBox.classList.add("has-problem");
    }

    resultBox.innerHTML = `

        <strong>
            ${escapeHtml(status)}
        </strong>

        ${needsAttention ? `
            <div class="result-problem">
                <span class="result-problem-label">Issue to resolve</span>
                <p>${escapeHtml(message)}</p>
            </div>
        ` : `
            <div class="result-message">
                ${escapeHtml(message)}
            </div>
        `}

    `;

}


// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;

}


// ======================================================
// SUBMIT REQUEST
// ======================================================

async function submitRequest() {

    submitButton.disabled = true;
    submitButton.querySelector("span").textContent =
        "Validating...";

    const payload = {

        requester:
            requesterInput.value.trim(),

        projectCode:
            projectCodeInput.value.trim(),

        environment:
            environmentInput.value,

        region:
            regionInput.value,

        owner:
            ownerInput.value.trim()

    };


    showResult(
        "Processing",
        "Sending request through the backend..."
    );


    try {

        const response =
            await fetch(
                "/api/validate",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(payload)

                }
            );


        const data =
            await response.json();


        showResult(
            data.status || "Unknown",
            data.message ||
                "No response message received."
        );


    }

    catch (error) {

        console.error(
            "Request error:",
            error
        );


        showResult(
            "Error",
            "Could not connect to the backend."
        );

    }

    finally {

        submitButton.disabled = false;
        submitButton.querySelector("span").textContent =
            "Validate request";

    }

}


// ======================================================
// FORM SUBMIT
// ======================================================

requestForm?.addEventListener(
    "submit",
    function (event) {

        event.preventDefault();

        submitRequest();

    }
);


// ======================================================
// VALID DEMO
// ======================================================

document
    .getElementById("validDemo")
    ?.addEventListener(
        "click",
        function () {

            projectCodeInput.value =
                "T085-P085";

            regionInput.value =
                "indiasouthcentral";

            environmentInput.value =
                "Development";

            submitRequest();

        }
    );


// ======================================================
// REGION EXCEPTION DEMO
// ======================================================

document
    .getElementById("regionDemo")
    ?.addEventListener(
        "click",
        function () {

            projectCodeInput.value =
                "T085-P085";

            regionInput.value =
                "centralindia";

            environmentInput.value =
                "Development";

            submitRequest();

        }
    );


// ======================================================
// PROJECT EXCEPTION DEMO
// ======================================================

document
    .getElementById("projectDemo")
    ?.addEventListener(
        "click",
        function () {

            projectCodeInput.value =
                "INVALID-001";

            regionInput.value =
                "indiasouthcentral";

            environmentInput.value =
                "Development";

            submitRequest();

        }
    );


// ======================================================
// LOAD LIVE AZURE RESOURCES
// ======================================================

async function loadAzureResources() {

    resourceStatus.textContent =
        "Connecting to Azure Resource Manager...";


    resourcesContainer.innerHTML = "";


    try {

        const response =
            await fetch(
                "/api/azure/resources"
            );


        const data =
            await response.json();


        if (!data.connected) {

            resourceStatus.textContent =
                "Azure connection failed.";

            return;

        }


        resourceStatus.textContent =
            `${data.count} resource(s) found in ${data.resourceGroup}`;


        if (
            !data.resources ||
            data.resources.length === 0
        ) {

            resourcesContainer.innerHTML = `

                <div class="resource-card">

                    <h3>
                        No resources found
                    </h3>

                    <p>
                        The resource group is currently empty.
                    </p>

                </div>

            `;

            return;

        }


        data.resources.forEach(
            (resource) => {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "resource-card";


                const tags =
                    resource.tags || {};


                const tagHtml =
                    Object.entries(tags)
                        .map(
                            ([key, value]) => {

                                return `

                                    <span class="resource-tag">

                                        ${escapeHtml(key)}
                                        =
                                        ${escapeHtml(value)}

                                    </span>

                                `;

                            }
                        )
                        .join("");


                card.innerHTML = `

                    <div class="resource-title">

                        <h3>
                            ${escapeHtml(
                                resource.name
                            )}
                        </h3>

                    </div>


                    <span class="resource-type">

                        ${escapeHtml(
                            resource.type
                        )}

                    </span>


                    <div class="resource-detail">

                        <span>
                            Region
                        </span>

                        <strong>
                            ${escapeHtml(
                                resource.location ||
                                "Unknown"
                            )}
                        </strong>

                    </div>


                    <div class="resource-detail">

                        <span>
                            Provisioning
                        </span>

                        <strong>
                            ${escapeHtml(
                                resource.provisioningState ||
                                "Unknown"
                            )}
                        </strong>

                    </div>


                    <div class="tag-row">

                        ${tagHtml}

                    </div>

                `;


                resourcesContainer.appendChild(
                    card
                );

            }
        );


    }

    catch (error) {

        console.error(
            "Azure resource error:",
            error
        );


        resourceStatus.textContent =
            "Could not load Azure resources.";

    }

}


// Make available to inline HTML onclick
window.loadAzureResources =
    loadAzureResources;


// ======================================================
// CHECK BACKEND CONNECTION
// ======================================================

async function checkBackendConnection() {

    const label =
        connectionStatus.querySelector("span:last-child");

    try {

        const response =
            await fetch("/api/health");

        if (!response.ok) {
            throw new Error("Health check failed.");
        }

        const data =
            await response.json();

        const azureConfigured =
            data.azureLogicAppConfigured &&
            data.azureSubscriptionConfigured &&
            data.azureResourceGroupConfigured;

        connectionStatus.dataset.state =
            azureConfigured ? "online" : "warning";

        label.textContent =
            azureConfigured
                ? "Backend connected"
                : "Azure configuration incomplete";

    }

    catch (error) {

        console.error("Backend health check failed:", error);

        connectionStatus.dataset.state = "offline";
        label.textContent = "Backend unavailable";

    }

}


// ======================================================
// INITIAL LOAD
// ======================================================

checkBackendConnection();
if (resourcesContainer) {
    loadAzureResources();
}