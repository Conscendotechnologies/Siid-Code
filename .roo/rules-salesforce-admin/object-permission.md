**Salesforce Custom Profile Creation**

- When user asks to assign object permissions to a profile, always first retrieve the profile data following this flow:

1. List all available Profile metadata from the Salesforce org:

    ```bash
    sf org list metadata -m Profile --json > profiles.json
    ```

    **Notes:**

    - This command produces a JSON list of available Profile metadata in the target org.
    - Saving the output to `profiles.json` ensures you have an up-to-date authoritative mapping between the friendly names and the backend metadata names.

2. Inspect `profiles.json` to understand the available profiles and their exact API/backend names.

3. Map the user-provided profile name to the exact `fullName` in `profiles.json`:

    - Use an exact match when possible. If the user uses a friendly/display name (for example, "System Administrator"), implement a mapping or a small fuzzy-match routine that compares the user input against `fullName` and `fileName` values from `profiles.json` and returns the closest match.

    - Example mapping logic (shell/Node pseudocode):

        ```bash
        # extract fullNames into a plain list
        jq -r '.result[].fullName' profiles.json > profile-names.txt

        # do case-insensitive search or fuzzy match to find the best candidate
        # (implement in Node.js or a small script to return the closest fullName)
        ```

4. Once you have the correct backend `fullName` for the profile, retrieve the profile metadata file:

    - Use the <retrieve_sf_metadata> tool with metadata_type "Profile" and metadata_name "<FULL_NAME>" to retrieve the specific profile
    - Replace `<FULL_NAME>` with the exact backend name you mapped from `profiles.json`.

\*\*Note: you have to retrieve profile every time to ensure that we have latest data.

- Then first make list make list of objects with permission which user want to assign permission to which profile
  \*\*Note: This is structure of adding object permissions
  <objectPermissions>
  <allowCreate>true</allowCreate>
  <allowDelete>true</allowDelete>
  <allowEdit>true</allowEdit>
  <allowRead>true</allowRead>
  <modifyAllRecords>true</modifyAllRecords>
  <object>ObjectName</object>
  <viewAllRecords>true</viewAllRecords>
  </objectPermissions>
- \*\*Note: While assiging the permissions make sure you these rules
  <rules>

1. read permisssion is required to give create permission.
1. read permisssion is required to give edit permission.
1. read and edit permissions are required to give delete permission.
1. read permission is required to give view all records permission.
1. read, edit, delete and view all records permission are required to give modify all records permission.
   </rules>

- Then object permisison asignment task is completed.
