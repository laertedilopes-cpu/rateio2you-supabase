/* Confere o token do usuário logado no site.
   Não confiamos em nada que venha do navegador sem validar aqui. */

export async function requireUser(req) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    const err = new Error("É preciso estar logado para pagar.");
    err.status = 401;
    throw err;
  }

  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !anon) {
    const err = new Error("Supabase não configurado no servidor.");
    err.status = 500;
    throw err;
  }

  const res = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = new Error("Sessão expirada. Entre novamente no site.");
    err.status = 401;
    throw err;
  }

  const user = await res.json();
  if (!user || !user.id) {
    const err = new Error("Sessão inválida.");
    err.status = 401;
    throw err;
  }
  return user;
}
