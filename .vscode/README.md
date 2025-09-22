# MCP Configuration Setup

This directory contains MCP (Model Context Protocol) configuration files for VS Code integration with Supabase.

## Setup Instructions

1. Copy `mcp.json.example` to `mcp.json`:
   ```
   cp .vscode/mcp.json.example .vscode/mcp.json
   ```

2. Get your Supabase personal access token:
   - Go to https://supabase.com/dashboard/account/tokens
   - Create a new token with appropriate permissions
   - Copy the token

3. The `mcp.json` file is configured to prompt for the access token when needed, so you don't need to hardcode it in the file.

4. To prevent accidentally committing your `mcp.json` file with sensitive tokens:
   ```bash
   git ignore-mcp    # Ignore the file from Git tracking
   git unignore-mcp  # Re-enable tracking if needed
   ```

## Important Notes

- **Security**: The `mcp.json` file is ignored by Git (in `.gitignore`) to prevent accidental exposure of access tokens
- **Local Tracking**: The file is also configured with `git update-index --assume-unchanged` to prevent `git add .` from staging it
- **Template**: Always use `mcp.json.example` as the template for new setups
- **Tokens**: Never commit actual access tokens to version control

## Git Aliases

The following Git aliases are available for managing the MCP configuration:

```bash
git ignore-mcp    # Make Git ignore changes to .vscode/mcp.json
git unignore-mcp  # Re-enable tracking of .vscode/mcp.json if needed
```

## Available Servers

- `supabase-macos-linux`: Read-only access for macOS/Linux
- `supabase-windows`: Read-only access for Windows  
- `supabase-write-mode`: Write access (use with caution)

## Project Reference

Current project ref: `cdthersvldpnlbvpufrr`