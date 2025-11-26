# Salesforce Profile Management

## Profile Mapping and Retrieval (new recommended flow)

When the user asks to "create a profile" or to "create from <source profile>", follow this recommended, deterministic flow:

1. Retrieve the list of Profile metadata from the org using the CLI and store it in the workspace.

    ```bash
    # Run this to list profile metadata in JSON format and save into profiles.json
    sf org list metadata -m Profile --json > profiles.json
    ```

    Notes:

    - This command uses the Salesforce CLI SLI (`sf org list metadata`) to produce a JSON list of available Profile metadata in the target org.
    - Saving the output to `profiles.json` ensures you have an up-to-date authoritative mapping between the friendly names and the backend metadata names.

2. Inspect `profiles.json` to understand the available profiles and their exact API/backend names.

3. Map the user-provided profile name to the exact `fullName` in `profiles.json`.

    - Use an exact match when possible. If the user uses a friendly/display name (for example, "System Administrator"), implement a mapping or a small fuzzy-match routine that compares the user input against `fullName` and `fileName` values from `profiles.json` and returns the closest match.

    - Example mapping logic (shell/Node pseudocode):

        ```bash
        # extract fullNames into a plain list
        jq -r '.result[].fullName' profiles.json > profile-names.txt

        # do case-insensitive search or fuzzy match to find the best candidate
        # (implement in Node.js or a small script to return the closest fullName)
        ```

4. Once you have the correct backend `fullName` for the source profile, retrieve the profile metadata file into your local source tree (if not already retrieved).

    - Use the <retrieve_sf_metadata> tool with metadata_type "Profile" and metadata_name "<FULL_NAME>" to retrieve the specific profile
    - Replace `<FULL_NAME>` with the exact backend name you mapped from `profiles.json`.

5. Copy or clone the retrieved profile file to create the new profile XML file. Use relative paths and keep the metadata filename consistent with the new profile `fullName` you plan to deploy.

    ```bash
    # Example: copy retrieved Admin.profile-meta.xml to NewProfile.profile-meta.xml
    copy force-app/main/default/profiles/Admin.profile-meta.xml force-app/main/default/profiles/NewProfile.profile-meta.xml
    ```

6. Update the new profile XML content if needed (display name, permissions, layout assignments, etc.).

## Dry Run and deployment for Profiles (Mandatory)

- Before deploying the created Profiles into the org do the dry run first using below command
- Do dry run for all profiles at once.
  `sf project deploy start --dry-run --source-dir force-app/main/default/Profiles/
<profilename>`
- If got any errors after dry run solve them.
- After successful dry run then proceed with deloyment process.
- Do deploy all profiles at once.
  `sf project deploy start --source-dir force-app/main/default/assignmentRules/
<profilename>`
- Replace <profilename> with the actual profiles that are created.

8. Confirm deployment success and update `profiles.json` (rerun step 1) to keep the mapping file current.

9. When interacting with users (chat or CLI), always run step 1 automatically if `profiles.json` is missing or older than a configurable TTL (for example, 24 hours). This keeps names in sync with the org and avoids ambiguous profile-name issues.
