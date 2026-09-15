import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { workspaceAccess } from "../middleware/workspaceAccess.middleware";
import { prisma } from "../config/db";
import { vaultService } from "../services/security/vault.service";
import { slackService } from "../services/integrations/slack.service";
import { sheetsService } from "../services/integrations/sheets.service";
import { notionService } from "../services/integrations/notion.service";
import { logger } from "../config/logger";

const router = Router();

// Slack Integration
/** GET /api/integrations/slack/channels */
router.get("/slack/channels", authMiddleware, async (req, res) => {
  try {
    const channels = await slackService.listChannels();
    res.json(channels);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** POST /api/integrations/slack/send — { channel, text } */
router.post("/slack/send", authMiddleware, async (req, res) => {
  try {
    const { channel, text } = req.body;
    if (!channel || !text)
      return res.status(400).json({ message: "channel and text are required" });

    await slackService.sendMessage(channel, text);
    res.json({ message: "Message sent to Slack" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Google Sheets Integration
/** GET /api/integrations/sheets/read — { spreadsheetId, range } */
router.get("/sheets/read", authMiddleware, async (req, res) => {
  try {
    const { spreadsheetId, range } = req.query as {
      spreadsheetId?: string;
      range?: string;
    };

    if (!spreadsheetId || !range)
      return res.status(400).json({ message: "spreadsheetId and range are required" });

    const rows = await sheetsService.readRange(spreadsheetId as string, range as string);
    const text = sheetsService.rowsToText(rows);

    res.json({ rows, text });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** POST /api/integrations/sheets/append — { spreadsheetId, range, values } */
router.post("/sheets/append", authMiddleware, async (req, res) => {
  try {
    const { spreadsheetId, range, values } = req.body;

    if (!spreadsheetId || !range || !values)
      return res.status(400).json({ message: "spreadsheetId, range, and values are required" });

    await sheetsService.appendRows(spreadsheetId, range, values);
    res.json({ message: "Rows appended to Google Sheet" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Notion Integration
/** POST /api/integrations/notion/pages — { databaseId, title, content } */
router.post("/notion/pages", authMiddleware, async (req, res) => {
  try {
    const { databaseId, title, content } = req.body;

    if (!databaseId || !title || !content)
      return res.status(400).json({ message: "databaseId, title, and content are required" });

    const pageId = await notionService.createPage(databaseId, title, content);
    res.status(201).json({ pageId, message: "Notion page created" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/integrations/notion/database/:databaseId — query a database */
router.get("/notion/database/:databaseId", authMiddleware, async (req, res) => {
  try {
    const pages = await notionService.queryDatabase(req.params.databaseId as string);
    res.json(pages);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/integrations/notion/page/:pageId — get page text */
router.get("/notion/page/:pageId", authMiddleware, async (req, res) => {
  try {
    const text = await notionService.getPageText(req.params.pageId as string);
    res.json({ text });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Encrypted Integration Vault
/**
 * GET /api/integrations/credentials/:workspaceId — List credentials for a workspace
 * Security invariant: NEVER returns decrypted values or ciphertexts. Returns masked hints only.
 */
router.get(
  "/credentials/:workspaceId",
  authMiddleware,
  workspaceAccess,
  async (req, res) => {
    try {
      const workspaceId = req.params.workspaceId as string;

      const credentials = await prisma.integrationCredential.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
      });

      const maskedList = credentials.map((c) => {
        let hint = "••••••••";
        try {
          const plain = vaultService.decryptSecret(c.encryptedValue);
          hint = vaultService.maskSecret(plain);
        } catch {
          hint = "••••••••";
        }

        return {
          id: c.id,
          workspaceId: c.workspaceId,
          provider: c.provider,
          label: c.label,
          hint,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      });

      res.json(maskedList);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
);

/**
 * POST /api/integrations/credentials/:workspaceId — Upsert an encrypted secret
 * Encrypts payload with AES-256-GCM before database insertion.
 */
router.post(
  "/credentials/:workspaceId",
  authMiddleware,
  workspaceAccess,
  async (req, res) => {
    try {
      const workspaceId = req.params.workspaceId as string;
      const userId = (req as any).userId as string;
      const { provider, label, value } = req.body;

      if (!provider || !label || !value) {
        return res
          .status(400)
          .json({ message: "provider, label, and value are required" });
      }

      // Encrypt with envelope AES-256-GCM
      const encryptedValue = vaultService.encryptSecret(String(value));

      const credential = await prisma.integrationCredential.upsert({
        where: {
          workspaceId_provider_label: {
            workspaceId,
            provider,
            label,
          },
        },
        create: {
          workspaceId,
          provider,
          label,
          encryptedValue,
          createdById: userId,
        },
        update: {
          encryptedValue,
          updatedAt: new Date(),
        },
      });

      res.status(201).json({
        id: credential.id,
        workspaceId: credential.workspaceId,
        provider: credential.provider,
        label: credential.label,
        hint: vaultService.maskSecret(String(value)),
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
);

/**
 * DELETE /api/integrations/credentials/:workspaceId/:id — Delete a credential
 */
router.delete(
  "/credentials/:workspaceId/:id",
  authMiddleware,
  workspaceAccess,
  async (req, res) => {
    try {
      const id = req.params.id as string;
      const workspaceId = req.params.workspaceId as string;

      const cred = await prisma.integrationCredential.findUnique({
        where: { id },
      });

      if (!cred || cred.workspaceId !== workspaceId) {
        return res.status(404).json({ message: "Credential not found" });
      }

      await prisma.integrationCredential.delete({
        where: { id },
      });

      res.json({ message: "Credential deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
);

export default router;
