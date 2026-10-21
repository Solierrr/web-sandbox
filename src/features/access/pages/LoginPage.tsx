import { useState } from "react";
import { Access, Surface, ToolbarAction } from "@solaria.network/web-lib";
import { login } from "../access.service";
export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Access
      heading="Portão de testes lógicos"
      helperText="Faça login para continuar."
      submitLabel="Entrar no sandbox"
      logoInteractive
      logoWidth={7}
      compact
      busy={busy}
      error={error}
      fields={[
        {
          name: "email",
          label: "E-mail",
          placeholder: "seu.email@exemplo.com",
          type: "email",
          autoComplete: "username",
        },
        {
          name: "password",
          label: "Senha",
          placeholder: "Sua senha",
          password: true,
          autoComplete: "current-password",
        },
      ]}
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        setBusy(true);
        setError("");
        void login(String(data.get("email")), String(data.get("password")))
          .catch((failure: Error) => setError(failure.message))
          .finally(() => setBusy(false));
      }}
      footer={
        <Surface contentClassName="flex items-center justify-center gap-3 p-1">
          <ToolbarAction
            content="?"
            label="Ajuda do sandbox"
            to="https://github.com/Solierrr/web-sandbox#readme"
            target="_blank"
            rel="noopener noreferrer"
          />
        </Surface>
      }
    />
  );
}
