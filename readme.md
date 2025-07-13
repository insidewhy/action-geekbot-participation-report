# action-geekbot-participation-report

Generate a participation report and post it to a slack channel

## Example report

**Geekbot Participation Summary**

```
Chu Totoro:             60%
Nakamura:               100% - late: 1
Kazu Makino:            100%
Avram Dahb Singh Sahib: 100%
Total:                  90%  - late: 1
```

## Installation

An example workflow configuration:

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
  post-geekbot-participation-report:
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
          # The time to consider as the start of a day for a report, if the report
          # was triggered on a Thursday and the report duration is 7 days then all
          # reports from 6am on the prior Wednesday will be considered
          start-time: '06:00'
          # The days that represent work days, 0 being Sunday and 6 being Saturday
          work-days: '12345'
          # The rest of the parameters are optional, the following shows the defaults
          # This is the number of work days the report should cover, it defaults to
          # the number of configured work days, e.g. 5 for '12345'
          duration: 5
          # The heading to post above the report in slack mrdkwn format
          heading: '**Geekbot Participation Summary**'
          # When set to a string in hh:mm format then the number of late reports will
          # be added to the participation summary of each user, a report is considered
          # late if it exceeds the due-by-time or preceeds the start-time
          due-by-time: ''
```

- The slack channel ID must be given in `slack-channel` rather than the name of the channel, this can be retrieved by clicking on the channel name in slack.
- The `SLACK_TOKEN` secret should be the `Bot User OAuth Token` of a slack app which must be created and installed in the slack workspace. This token must have the `chat:write` permissions. The app bot must be invited to a channel to be able to post charts to it.
- The `GEEKBOT_TOKEN` can be retrieved from the geekbot admin UI
