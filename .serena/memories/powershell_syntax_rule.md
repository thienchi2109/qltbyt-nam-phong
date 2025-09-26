# PowerShell Syntax Rule

## Command Chaining in PowerShell

When working with PowerShell (pwsh), use the semicolon (`;`) as the command separator instead of the double ampersand (`&&`).

### Correct Syntax:
```powershell
cd D:/qltbyt-nam-phong; npm run dev
```

### Incorrect Syntax:
```powershell
cd D:/qltbyt-nam-phong && npm run dev
```

### Explanation:
- PowerShell uses `;` as the command separator to run multiple commands sequentially
- The `&&` operator is specific to bash/sh shells and doesn't work reliably in PowerShell
- This rule applies when the user's environment shows `"shell": {"name": "pwsh"}`

### Additional PowerShell Considerations:
- Use forward slashes (`/`) or escaped backslashes (`\\`) in paths
- PowerShell cmdlets follow Verb-Noun naming convention
- For conditional execution, use PowerShell's `-and`, `-or`, and other logical operators