import { prisma } from "../../config/db";
import { vaultService } from "../security/vault.service";
import { slackService } from "./slack.service";
import { notionService } from "./notion.service";
import { sheetsService } from "./sheets.service";
import { logger } from "../../config/logger";

export interface ActionDispatchParams {
  actionType: "slack" | "notion" | "sheets" | string;
  config: Record<string, any>;
  inputContext: string;
  workspaceId: string;
}

export interface ActionDispatchResult {
  output: string;
  outputJson: Record<string, any>;
}

function expandVariables(template: string, input: string): string {
  let result = template.replace(/{{\s*input\s*}}/g, input);
  try {
    const parsed = JSON.parse(input);
    if (typeof parsed === "object" && parsed !== null) {
      result = result.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
        const parts = key.split(".");
        let val = parsed;
        for (const p of parts) {
          if (val && typeof val === "object" && p in val) {
            val = val[p];
          } else {
            return `{{${key}}}`;
          }
        }
        return val !== undefined ? String(val) : `{{${key}}}`;
      });
    }
  } catch {}
  return result;
}

/**
 * Deep ActionDispatcher Module.
 * Encapsulates multi-tenant credential resolution, AES-256-GCM vault decryption,
 * variable expansion, and provider dispatch behind a single unified interface.
 */
export const actionDispatcher = {
  /**
   * Resolves workspace-scoped credential from the encrypted vault.
   * Falls back to undefined if not found so provider uses default env tokens.
   */
  async resolveCredential(workspaceId: string, provider: string): Promise<string | undefined> {
    try {
      const cred = await prisma.integrationCredential.findFirst({
        where: {
          workspaceId,
          provider: {
            in: [provider.toLowerCase(), provider.toUpperCase()],
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      if (cred?.encryptedValue) {
        return vaultService.decryptSecret(cred.encryptedValue);
      }
    } catch (err: any) {
      logger.warn(`Failed to resolve vault credential for ${provider} in workspace ${workspaceId}: ${err.message}`);
    }
    return undefined;
  },

  /**
   * Dispatches an integration action with on-demand credential injection and variable expansion.
   */
  async dispatch(params: ActionDispatchParams): Promise<ActionDispatchResult> {
    const { actionType, config, inputContext, workspaceId } = params;

    switch (actionType) {
      case "slack": {
        const channel = config.channel || "general";
        const messageTemplate = config.message || "Workflow notification: {{input}}";
        const expandedMessage = expandVariables(messageTemplate, inputContext);

        // Resolve workspace credential if present
        const tokenOverride = await this.resolveCredential(workspaceId, "slack");

        logger.info(`ActionDispatcher: sending Slack message to ${channel} (workspace: ${workspaceId})`);
        await slackService.sendMessage(channel, expandedMessage, tokenOverride);

        const msg = `Message sent to Slack channel ${channel}: "${expandedMessage.slice(0, 50)}..."`;
        return {
          output: msg,
          outputJson: { channel, message: expandedMessage },
        };
      }

      case "notion": {
        const databaseId = config.databaseId || "";
        const titleTemplate = config.title || "New Workflow Task";
        const contentTemplate = config.content || "Content: {{input}}";

        const expandedTitle = expandVariables(titleTemplate, inputContext);
        const expandedContent = expandVariables(contentTemplate, inputContext);

        const tokenOverride = await this.resolveCredential(workspaceId, "notion");

        logger.info(`ActionDispatcher: creating Notion page in ${databaseId} (workspace: ${workspaceId})`);
        const pageId = await notionService.createPage(databaseId, expandedTitle, expandedContent, tokenOverride);

        const msg = `Created Notion page with ID ${pageId} and title: "${expandedTitle}"`;
        return {
          output: msg,
          outputJson: { pageId, title: expandedTitle, databaseId },
        };
      }

      case "sheets": {
        const spreadsheetId = config.spreadsheetId || "";
        const range = config.range || "A1";
        const valuesTemplate = config.values || ["{{input}}"];

        const expandedValues = valuesTemplate.map((v: any) => {
          if (typeof v === "string") return expandVariables(v, inputContext);
          return v;
        });

        logger.info(`ActionDispatcher: appending rows to Google Sheet ${spreadsheetId} (workspace: ${workspaceId})`);
        await sheetsService.appendRows(spreadsheetId, range, [expandedValues]);

        const msg = `Appended row of values to Google Sheet range ${range}: ${JSON.stringify(expandedValues)}`;
        return {
          output: msg,
          outputJson: { spreadsheetId, range, values: expandedValues },
        };
      }

      default:
        throw new Error(`Unsupported action type: ${actionType}`);
    }
  },
};
