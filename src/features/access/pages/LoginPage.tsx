import { useState } from "react";
import { Access } from "@solaria.network/web-lib";
import { login } from "../access.service";
export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Access
      heading="Sandbox QA"
      helperText="Entre com sua conta de QA para testar os serviços do Solaria."
      submitLabel="Entrar no sandbox"
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
          placeholder: "Sua senha de QA",
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
      footer="Ambiente de QA. As operações executadas aqui podem alterar os dados de teste."
    />
  );
}
