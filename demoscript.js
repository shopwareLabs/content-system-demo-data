import crypto from "node:crypto";
import fs from "node:fs";

const SW_ENV_URL = process.env.SW_ENV_URL || "http://localhost:8000";
const SW_USER_NAME = process.env.SW_USER_NAME || "admin";
const SW_PASSWORD = process.env.SW_PASSWORD || "shopware";
const PRODUCT_CATEGORY = process.env.PRODUCT_CATEGORY || "Summer Fashion";

let apiClientAccessToken = null;

function createUUID() {
    return crypto.randomUUID().replace(/-/g, "");
}

function capitalizeString(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

async function authenticateWithUserCredentials(
    envPath = SW_ENV_URL,
    userName = SW_USER_NAME,
    password = SW_PASSWORD,
) {
    if (!userName || !password) {
        apiClientAccessToken = null;
        return false;
    }

    const authResponse = await fetch(`${envPath}/api/oauth/token`, {
        method: "POST",
        body: JSON.stringify({
            client_id: "administration",
            grant_type: "password",
            username: userName,
            password: password,
            scope: "write",
        }),
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (!authResponse.ok) {
        throw new Error(`Authentication failed: ${authResponse.statusText}`);
    }

    const authData = await authResponse.json();
    apiClientAccessToken = authData.access_token;
    return true;
}

async function getStandardTaxId() {
    const taxResponse = await fetch(`${SW_ENV_URL}/api/search/tax`, {
        method: "POST",
        body: JSON.stringify({ limit: 1 }),
        headers: {
            Authorization: `Bearer ${apiClientAccessToken}`,
            "Content-Type": "application/json",
        },
    });

    const taxData = await taxResponse.json();
    return taxData.data[0]?.id || null;
}

async function getCurrencyId(currency = "EUR") {
    const currencyResponse = await fetch(`${SW_ENV_URL}/api/search/currency`, {
        method: "POST",
        body: JSON.stringify({
            limit: 1,
            filter: [{ type: "equals", field: "isoCode", value: currency }],
        }),
        headers: {
            Authorization: `Bearer ${apiClientAccessToken}`,
            "Content-Type": "application/json",
        },
    });

    const currencyData = await currencyResponse.json();
    return currencyData.data[0]?.id || null;
}

async function getStandardSalesChannel(salesChannelName = "Storefront") {
    const salesChannelResponse = await fetch(`${SW_ENV_URL}/api/search/sales-channel`, {
        method: "POST",
        body: JSON.stringify({
            limit: 1,
            filter: [{ type: "equals", field: "name", value: salesChannelName }],
        }),
        headers: {
            Authorization: `Bearer ${apiClientAccessToken}`,
            "Content-Type": "application/json",
        },
    });

    const salesChannelData = await salesChannelResponse.json();
    return salesChannelData?.data?.[0] || null;
}

async function getDefaultProductMediaFolder(folderName = "Product Media") {
    const mediaFolderResponse = await fetch(`${SW_ENV_URL}/api/search/media-folder`, {
        method: "POST",
        body: JSON.stringify({
            limit: 1,
            filter: [{ type: "equals", field: "name", value: folderName }],
        }),
        headers: {
            Authorization: `Bearer ${apiClientAccessToken}`,
            "Content-Type": "application/json",
        },
    });

    const mediaFolderData = await mediaFolderResponse.json();
    return mediaFolderData?.data?.[0] || null;
}

async function createProductCategory(category, salesChannel) {
    const categoryName = capitalizeString(category.trim());

    const categorySearchResponse = await fetch(`${SW_ENV_URL}/api/search/category`, {
        method: "POST",
        body: JSON.stringify({
            limit: 1,
            filter: [
                {
                    type: "equals",
                    field: "name",
                    value: categoryName,
                },
            ],
        }),
        headers: {
            Authorization: `Bearer ${apiClientAccessToken}`,
            "Content-Type": "application/json",
        },
    });

    const categorySearchData = await categorySearchResponse.json();

    if (categorySearchData?.data?.[0]?.id) {
        return categorySearchData?.data?.[0];
    }

    const categoryResponse = await fetch(`${SW_ENV_URL}/api/category?_response`, {
        method: "POST",
        body: JSON.stringify({
            name: categoryName,
            parentId: salesChannel.attributes.navigationCategoryId,
            displayNestedProducts: true,
            type: "page",
            productAssignmentType: "product",
            visible: true,
            active: true,
        }),
        headers: {
            Authorization: `Bearer ${apiClientAccessToken}`,
            "Content-Type": "application/json",
        },
    });

    const categoryData = await categoryResponse.json();
    return categoryData?.data || null;
}

async function syncApiCall(payload) {
    const syncResponse = await fetch(`${SW_ENV_URL}/api/_action/sync`, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
            Authorization: `Bearer ${apiClientAccessToken}`,
            "Content-Type": "application/json",
        },
    });

    return syncResponse.json();
}

async function uploadMedia(mediaUploads) {
    const mediaResponse = await Promise.all(
        mediaUploads.map(async (media) => {
            return await fetch(
                `${SW_ENV_URL}/api/_action/media/${media.id}/upload?extension=png&fileName=${media.image.name}-${media.id}`,
                {
                    method: "POST",
                    body: Buffer.from(media.image.data, "base64"),
                    headers: {
                        Authorization: `Bearer ${apiClientAccessToken}`,
                        "Content-Type": "image/png",
                    },
                },
            );
        }),
    );

    return mediaResponse;
}

await authenticateWithUserCredentials();

const standardTaxId = await getStandardTaxId();
const standardSalesChannel = await getStandardSalesChannel();
const standardCategoryId = standardSalesChannel.attributes.navigationCategoryId;
const currencyId = standardSalesChannel.attributes.currencyId;
const defaultProductMediaFolder = await getDefaultProductMediaFolder();
const heroImageMediaId = createUUID();

const productCategory = await createProductCategory(PRODUCT_CATEGORY, standardSalesChannel);

const propertyGroupsPayload = fs.readFileSync("demo/propertyGroupsPayload.json", "utf8");
const mediaUploadsPayload = fs.readFileSync("demo/mediaUploads.json", "utf8");
let productPayload = fs.readFileSync("demo/productPayload.json", "utf8");
let contentPagePayload = fs.readFileSync("demo/contentPagePayload.json", "utf8");
let heroImageMediaPayload = fs.readFileSync("demo/heroImageMediaPayload.json", "utf8");
let heroImageMediaUploadsPayload = fs.readFileSync("demo/heroImageMediaUploads.json", "utf8");

productPayload = productPayload.replaceAll("{{ taxId }}", standardTaxId);
productPayload = productPayload.replaceAll("{{ currencyId }}", currencyId);
productPayload = productPayload.replaceAll("{{ salesChannelId }}", standardSalesChannel.id);
productPayload = productPayload.replaceAll("{{ navigationCategoryId }}", standardCategoryId);
productPayload = productPayload.replaceAll("{{ productCategoryId }}", productCategory.id);
productPayload = productPayload.replaceAll(
    "{{ defaultProductMediaFolderId }}",
    defaultProductMediaFolder.id,
);

contentPagePayload = contentPagePayload.replaceAll(
    "{{ navigationCategoryId }}",
    standardCategoryId,
);
contentPagePayload = contentPagePayload.replaceAll("{{ salesChannelId }}", standardSalesChannel.id);
contentPagePayload = contentPagePayload.replaceAll("{{ heroImageMediaId }}", heroImageMediaId);

heroImageMediaPayload = heroImageMediaPayload.replaceAll(
    "{{ heroImageMediaId }}",
    heroImageMediaId,
);
heroImageMediaPayload = heroImageMediaPayload.replaceAll(
    "{{ defaultProductMediaFolderId }}",
    defaultProductMediaFolder.id,
);
heroImageMediaUploadsPayload = heroImageMediaUploadsPayload.replaceAll(
    "{{ heroImageMediaId }}",
    heroImageMediaId,
);

const propertyGroupsPayloadData = JSON.parse(propertyGroupsPayload);
const productPayloadData = JSON.parse(productPayload);
const mediaUploadsPayloadData = JSON.parse(mediaUploadsPayload);
const contentPagePayloadData = JSON.parse(contentPagePayload);
const heroImageMediaPayloadData = JSON.parse(heroImageMediaPayload);
const heroImageMediaUploadsPayloadData = JSON.parse(heroImageMediaUploadsPayload);

try {
    await syncApiCall(propertyGroupsPayloadData);
} catch (error) {
    console.error(error);
}

try {
    await syncApiCall(productPayloadData);
} catch (error) {
    console.error(error);
}

try {
    await uploadMedia(mediaUploadsPayloadData);
} catch (error) {
    console.error(error);
}

try {
    const contentPageSyncResponse = await syncApiCall(contentPagePayloadData);

    if (contentPageSyncResponse.errors?.length > 0) {
        for (const error of contentPageSyncResponse.errors) {
            console.error(error);
        }
    }
} catch (error) {
    console.error(error);
}

try {
    await syncApiCall(heroImageMediaPayloadData);
} catch (error) {
    console.error(error);
}

try {
    await uploadMedia(heroImageMediaUploadsPayloadData);
} catch (error) {
    console.error(error);
}
