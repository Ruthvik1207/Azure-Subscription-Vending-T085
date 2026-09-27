require("dotenv").config();

const express = require("express");
const path = require("path");

const { DefaultAzureCredential } = require("@azure/identity");
const { ResourceManagementClient } = require("@azure/arm-resources");

const app = express();

// ======================================================
// CONFIGURATION
// ======================================================

const PORT = process.env.PORT || 3000;

const AZURE_LOGIC_APP_URL =
    process.env.AZURE_LOGIC_APP_URL;

const AZURE_SUBSCRIPTION_ID =
    process.env.AZURE_SUBSCRIPTION_ID;

const AZURE_RESOURCE_GROUP =
    process.env.AZURE_RESOURCE_GROUP;


// ======================================================
// AZURE AUTHENTICATION
// ======================================================

if (!AZURE_SUBSCRIPTION_ID) {
    console.error(
        "ERROR: AZURE_SUBSCRIPTION_ID is missing from .env"
    );
}

if (!AZURE_RESOURCE_GROUP) {
    console.error(
        "ERROR: AZURE_RESOURCE_GROUP is missing from .env"
    );
}

if (!AZURE_LOGIC_APP_URL) {
    console.error(
        "ERROR: AZURE_LOGIC_APP_URL is missing from .env"
    );
}

const credential = new DefaultAzureCredential();

const resourceClient = new ResourceManagementClient(
    credential,
    AZURE_SUBSCRIPTION_ID
);


// ======================================================
// EXPRESS
// ======================================================

app.use(express.json({ limit: "50kb" }));


// Serve frontend
app.use(
    express.static(
        path.join(__dirname, "../frontend"),
        { index: "home.html" }
    )
);


// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/api/health", (req, res) => {

    res.json({
        status: "OK",
        backend: "T085-P085 Subscription Vending Backend",
        azureLogicAppConfigured:
            Boolean(AZURE_LOGIC_APP_URL),
        azureSubscriptionConfigured:
            Boolean(AZURE_SUBSCRIPTION_ID),
        azureResourceGroupConfigured:
            Boolean(AZURE_RESOURCE_GROUP)
    });

});

// ======================================================
// LIST AZURE RESOURCES
// READ ONLY
// ======================================================

app.get("/api/azure/resources", async (req, res) => {

    try {

        const resources = [];

        for await (
            const resource of resourceClient.resources.listByResourceGroup(
                AZURE_RESOURCE_GROUP
            )
        ) {

            resources.push({
                name: resource.name,
                type: resource.type,
                location: resource.location,
                provisioningState:
                    resource.properties?.provisioningState || "Unknown",
                tags: resource.tags || {}
            });

        }

        res.json({
            connected: true,
            resourceGroup: AZURE_RESOURCE_GROUP,
            count: resources.length,
            resources
        });

    } catch (error) {

        console.error(
            "Azure resource listing error:"
        );

        console.error(error);

        res.status(500).json({

            connected: false,

            message:
                "Could not list Azure resources.",

            error:
                error.message

        });

    }

});


// ======================================================
// DIRECT AZURE RESOURCE MANAGER TEST
// READ ONLY
// ======================================================

app.get("/api/azure/resource-group", async (req, res) => {

    try {

        const resourceGroup =
            await resourceClient.resourceGroups.get(
                AZURE_RESOURCE_GROUP
            );

        res.json({

            connected: true,

            name: resourceGroup.name,

            location: resourceGroup.location,

            provisioningState:
                resourceGroup.properties?.provisioningState ||
                "Unknown"

        });

    } catch (error) {

        console.error(
            "Azure Resource Manager error:"
        );

        console.error(error);

        res.status(500).json({

            connected: false,

            message:
                "Could not read the Azure resource group.",

            error:
                error.message

        });

    }

});


// ======================================================
// SUBSCRIPTION REQUEST
// FRONTEND -> BACKEND -> AZURE LOGIC APP
// ======================================================

app.post("/api/validate", async (req, res) => {

    try {

        const {
            requester,
            projectCode,
            environment,
            region,
            owner
        } = req.body || {};


        // ----------------------------------------------
        // Validate required fields
        // ----------------------------------------------

        if (
            ![requester, projectCode, environment, region, owner]
                .every((value) => typeof value === "string" && value.trim())
        ) {

            return res.status(400).json({

                status: "Rejected",

                message:
                    "All request fields are required."

            });

        }


        // ----------------------------------------------
        // Check Logic App configuration
        // ----------------------------------------------

        if (!AZURE_LOGIC_APP_URL) {

            return res.status(500).json({

                status: "Error",

                message:
                    "Azure Logic App URL is not configured in backend/.env"

            });

        }


        console.log("");
        console.log("========================================");
        console.log("SUBSCRIPTION REQUEST");
        console.log("========================================");

        console.log({
            requester,
            projectCode,
            environment,
            region,
            owner
        });


        // ----------------------------------------------
        // Send request to Azure Logic App
        // ----------------------------------------------

        const azureResponse =
            await fetch(
                AZURE_LOGIC_APP_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            requester:
                                requester.trim(),

                            projectCode:
                                projectCode.trim(),

                            environment:
                                environment.trim(),

                            region:
                                region.trim(),

                            owner:
                                owner.trim()

                        })
                }
            );


        // ----------------------------------------------
        // Read Azure response
        // ----------------------------------------------

        const responseText =
            await azureResponse.text();


        let azureData;


        try {

            azureData =
                JSON.parse(responseText);

        } catch {

            azureData = {

                status:
                    azureResponse.ok
                        ? "Approved"
                        : "Exception",

                message:
                    azureResponse.ok
                        ? responseText || "Azure returned no message."
                        : ""

            };

        }

        if (
            !azureData ||
            typeof azureData !== "object" ||
            Array.isArray(azureData)
        ) {

            azureData = {
                status: azureResponse.ok ? "Approved" : "Exception",
                message: azureResponse.ok
                    ? responseText || "Azure returned no message."
                    : ""
            };

        }

        if (!azureResponse.ok) {

            azureData = {
                ...azureData,
                status: "Exception",
                message:
                    typeof azureData.message === "string" && azureData.message.trim()
                        ? azureData.message
                        : `Azure Logic App returned HTTP ${azureResponse.status}. This request needs review.`
            };

        }


        console.log("");
        console.log("AZURE RESULT");
        console.log(azureData);
        console.log("========================================");
        console.log("");


        // ----------------------------------------------
        // Send Azure result back to frontend
        // ----------------------------------------------

        return res.status(200).json({

            status:
                azureData.status ||
                "Unknown",

            message:
                azureData.message ||
                "No message returned from Azure."

        });


    } catch (error) {

        console.error("");
        console.error(
            "Azure Logic App connection failed:"
        );

        console.error(error);

        console.error("");


        return res.status(502).json({

            status: "Error",

            message:
                "Backend could not connect to Azure Logic App."

        });

    }

});


app.use((error, req, res, next) => {

    if (res.headersSent) {
        return next(error);
    }

    const invalidJson =
        error.type === "entity.parse.failed";

    console.error("Request processing error:", error);

    return res.status(invalidJson ? 400 : 500).json({
        status: invalidJson ? "Rejected" : "Error",
        message: invalidJson
            ? "Request body must contain valid JSON."
            : "An unexpected server error occurred."
    });

});


// ======================================================
// FRONTEND FALLBACK
// Express 5 compatible
// ======================================================

app.use((req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "../frontend/index.html"
        )
    );

});


// ======================================================
// START SERVER
// ======================================================

app.listen(
    PORT,
    () => {

        console.log("");
        console.log("========================================");
        console.log(" T085-P085 Azure Subscription Vending");
        console.log("========================================");

        console.log(
            `Frontend: http://localhost:${PORT}`
        );

        console.log(
            `Health:   http://localhost:${PORT}/api/health`
        );

        console.log(
            `Azure RG: http://localhost:${PORT}/api/azure/resource-group`
        );

        console.log(
            `Azure Logic App configured: ${Boolean(AZURE_LOGIC_APP_URL)}`
        );

        console.log(
            `Azure Subscription configured: ${Boolean(AZURE_SUBSCRIPTION_ID)}`
        );

        console.log(
            `Azure Resource Group configured: ${Boolean(AZURE_RESOURCE_GROUP)}`
        );

        console.log("========================================");
        console.log("");

    }
);