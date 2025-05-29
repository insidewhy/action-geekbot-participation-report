# action-geekbot-participation-report

Generate a participation report and post it to a slack channel

## Installation

Add a step like this to a workflow

```yaml
name: geekbot-participation-report

on:
  workflow_dispatch:
    inputs:
      slack-channel:
        description: Slack channel id

  # Run at 6.20pm SGT (10.20am UTC) Monday to Friday
  schedule:
    - cron: '20 10 * * 1-5'

jobs:
  post-participation-report:
    runs-on: ubuntu-latest

    # these permissions are needed by the action
    permissions:
      issues: write
      pull-requests: write

    steps:
      - uses: insidewhy/action-geekbot-participation-report@v1
        with:
          geekbot-token: ${{ secrets.GEEKBOT_TOKEN }}
          slack-token: ${{ secrets.SLACK_TOKEN }}
          slack-channel: ${{ github.event.inputs.slack-channel || 'C42PZTP3ECZ' }}
          days: 7
          time: '09:00'
          workdays: '12345'
```

- The `SLACK_TOKEN` secret should be the `Bot User OAuth Token` of a slack app which must be created and installed in the slack workspace. This token must have the `chat:write` permissions. The app bot must be invited to a channel to be able to post charts to it.
- The `GEEKBOT_TOKEN` can be retrieved from the geekbot admin UI
