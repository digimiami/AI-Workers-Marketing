import { createClient } from "@supabase/supabase-js";

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function printHelp() {
  console.log(
    [
      "Create a Supabase user and grant org admin role.",
      "",
      "Required env:",
      "  SUPABASE_URL",
      "  SUPABASE_SERVICE_ROLE_KEY",
      "",
      "Args (or env fallbacks):",
      "  --email <email>           (or ADMIN_EMAIL)",
      "  --password <password>     (or ADMIN_PASSWORD)",
      "  --org <org name>          (or ORG_NAME, default: AiWorkers.vip)",
      "  --role <role>             (or ORG_ROLE, default: admin)",
      "",
      "Example (PowerShell):",
      "  $env:SUPABASE_URL='https://YOUR_PROJECT.supabase.co'",
      "  $env:SUPABASE_SERVICE_ROLE_KEY='YOUR_SERVICE_ROLE_KEY'",
      "  $env:ADMIN_PASSWORD='use-a-strong-password'",
      "  node scripts/create-admin.mjs --email digimiami@gmail.com --org 'AiWorkers.vip' --role admin",
      "",
    ].join("\n"),
  );
}

function required(name, value) {
  if (!value) {
    console.error(`Missing --${name}`);
    process.exit(2);
  }
  return value;
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.",
    );
    console.error("Run with --help for usage.");
    process.exit(2);
  }

  const email = required("email", getArg("email") ?? process.env.ADMIN_EMAIL);
  const password =
    getArg("password") ??
    process.env.ADMIN_PASSWORD ??
    process.env.PASSWORD;
  if (!password) {
    console.error("Missing --password (or ADMIN_PASSWORD env var).");
    process.exit(2);
  }

  const orgName = getArg("org") ?? process.env.ORG_NAME ?? "AiWorkers.vip";
  const role = getArg("role") ?? process.env.ORG_ROLE ?? "admin";

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // 1) Create or fetch user
  let userId;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) {
    // If user exists, fetch by email
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listed.error) throw listed.error;
    const match = (listed.data?.users ?? []).find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (!match) throw created.error;
    userId = match.id;
  } else {
    userId = created.data.user?.id;
  }

  if (!userId) {
    throw new Error("Failed to resolve user id.");
  }

  // 2) Create or fetch org
  let organizationId;
  const orgSelect = await admin
    .from("organizations")
    .select("id,name")
    .eq("name", orgName)
    .limit(1)
    .maybeSingle();
  if (orgSelect.error) throw orgSelect.error;
  if (orgSelect.data?.id) {
    organizationId = orgSelect.data.id;
  } else {
    const orgInsert = await admin
      .from("organizations")
      .insert({ name: orgName })
      .select("id")
      .single();
    if (orgInsert.error) throw orgInsert.error;
    organizationId = orgInsert.data.id;
  }

  // 3) Upsert membership
  const memberUpsert = await admin
    .from("organization_members")
    .upsert(
      { organization_id: organizationId, user_id: userId, role },
      { onConflict: "organization_id,user_id" },
    )
    .select("organization_id,user_id,role")
    .single();
  if (memberUpsert.error) throw memberUpsert.error;

  console.log(
    JSON.stringify(
      {
        ok: true,
        email,
        userId,
        organizationId,
        orgName,
        role,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e?.message ?? String(e));
  process.exit(1);
});

