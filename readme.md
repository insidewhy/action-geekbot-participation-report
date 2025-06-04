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
    # set this according to the timezone of your reports
    env:
      TZ: Asia/Singapore

    steps:
      - uses: insidewhy/action-geekbot-participation-report@v2
        with:
          # These parameters are mandatory
          geekbot-token: ${{ secrets.GEEKBOT_TOKEN }}
          slack-token: ${{ secrets.SLACK_TOKEN }}
          slack-channel: ${{ github.event.inputs.slack-channel || 'C42PZTP3ECZ' }}
          # The rest of the parameters are optional, the following shows the defaults
          # This is the number of days the report should cover, days not in
          # work-days do not contribute to the report
          duration: 7
          # The time to consider as the start of a day for a report, if the report was triggered
          # on a Thursday and the report duration is 7 days then all reports from 9am on the prior
          # Wednesday will be considered
          start-time: '06:00'
          # The days that represent work days, 0 being Sunday and 6 being Saturday
          work-days: '12345'
          # The heading to post above the report in slack mrdkwn format
          heading: '**Geekbot Participation Summary**'
          # When set to a string in hh:mm format then the number of late reports will
          # be added to the participation summary of each user, a report is considered
          # late if it exceeds the due-by-time or preceeds the start-time
          due-by-time: ''
```

- The `SLACK_TOKEN` secret should be the `Bot User OAuth Token` of a slack app which must be created and installed in the slack workspace. This token must have the `chat:write` permissions. The app bot must be invited to a channel to be able to post charts to it.
- The `GEEKBOT_TOKEN` can be retrieved from the geekbot admin UI
