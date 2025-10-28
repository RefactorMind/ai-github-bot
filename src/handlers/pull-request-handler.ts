import { Context } from 'probot';
import { PullRequestOpenedEvent } from '@octokit/webhooks-types';
import { GithubService } from '../services/github-service';

/**
 * Handles the 'pull_request.opened' event.
 * Welcomes first-time contributors.
 * @param context The Probot event context.
 */
export const handlePullRequestOpened = async (
  context: Context<"pull_request.opened">
) => {
  const payload = context.payload as PullRequestOpenedEvent;
  const { pull_request, repository } = payload;
  const octokit = context.octokit;
  const log = context.log;

  // 1. Extract info
  const owner = repository.owner.login;
  const repo = repository.name;
  const user = pull_request.user.login;
  const prNumber = pull_request.number;

  // 2. Initialize service
  const githubService = new GithubService(octokit, log);
  const botUsername = await githubService.getBotUsername();

  // 3. Don't respond to self
  if (user === botUsername) {
    log.info('PR was opened by the bot itself. Skipping.');
    return;
  }

  try {
    // 4. Check if it's the user's first contribution
    const isFirst = await githubService.isFirstContribution(owner, repo, user);

    if (isFirst) {
      log.info(`First contribution from @${user}. Sending welcome message.`);
      // 5. Post welcome message
      const welcomeMessage = `
Hi @${user}! 👋 Welcome to the \`${repo}\` repository, and thank you so much for your contribution! 🎉

We really appreciate you taking the time to submit this pull request. A maintainer will review it as soon as possible.

In the meantime, please make sure you've:
- Read our [CONTRIBUTING.md](https://github.com/${owner}/${repo}/blob/main/CONTRIBUTING.md) guide (if it exists).
- Added or updated tests for your changes.
- Updated any relevant documentation.

Thanks again!
`;
      // Post the comment to the PR (which is also an "issue" in the API)
      await githubService.postIssueComment(owner, repo, prNumber, welcomeMessage);
    } else {
      log.info(`Not a first-time contribution from @${user}. Skipping welcome.`);
    }
  } catch (error) {
    log.error(`Error handling PR #${prNumber} from @${user}:`, error);
  }
};

