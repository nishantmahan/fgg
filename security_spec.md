# Security Specification for DailyLink

## Data Invariants
1. A **Group** must belong to a single user (`userId`).
2. A **Task** must belong to a single user (`userId`) and a valid **Group** (`groupId`).
3. Users can only read, create, update, or delete their own Groups and Tasks.
4. `createdAt` fields are immutable after creation.
5. `updatedAt` fields must be updated to the server time during updates.
6. Entity IDs must match `^[a-zA-Z0-9_\-]+$`.

## The "Dirty Dozen" Payloads

### Group Collection
1. **Identity Spoofing**: Attempt to create a group for another user.
   ```json
   { "name": "Hack", "userId": "victim_uid", "dailyReset": true }
   ```
2. **Resource Poisoning**: Create a group with a massive name.
   ```json
   { "name": "A".repeat(2000), "userId": "attacker_uid", "dailyReset": true }
   ```
3. **Privilege Escalation**: Attempt to change another user's group `name`.
   ```json
   { "name": "Renamed" } // targeted at /groups/victim_group_id
   ```
4. **Immortality Breach**: Attempt to change `createdAt`.
   ```json
   { "createdAt": "2020-01-01T00:00:00Z" }
   ```

### Task Collection
5. **Orphaned Record**: Create a task for a group that doesn't exist.
   ```json
   { "url": "https://evil.com", "userId": "attacker_uid", "groupId": "non_existent_group" }
   ```
6. **Identity Spoofing**: Create a task for another user's group.
   ```json
   { "url": "https://evil.com", "userId": "attacker_uid", "groupId": "victim_group_id" }
   ```
7. **Type Mismatch**: Send a boolean as a URL.
   ```json
   { "url": true, "userId": "attacker_uid", "groupId": "valid_group" }
   ```
8. **Shadow Field Injection**: Inject a field not in the schema.
   ```json
   { "url": "https://ok.com", "userId": "attacker_uid", "groupId": "valid_group", "isAdmin": true }
   ```
9. **State Shortcutting**: Mark a task as completed without setting `completedAt`.
   ```json
   { "completed": true } // Missing completedAt logic
   ```
10. **Value Poisoning**: Set a negative `order`.
    ```json
    { "order": -1 }
    ```
11. **PII Leak Attempt**: Unauthorized `get` of a task by ID without query filtering.
12. **Unauthorized Deletion**: Attempt to delete another user's task.

## The Test Runner (Plan)
We will use `firestore.rules.test.ts` (conceptual) to ensure all the above fail.
