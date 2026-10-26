import { useState } from "react";
import { Access } from "@solaria.network/web-lib";
import { login } from "../access.service";
export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Access
      heading="Portão lógico de processos"
      helperText="Entre com uma conta para testar os domínios do projeto."
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
          placeholder: "Insira seu e-mail aqui",
          type: "email",
          autoComplete: "username",
        },
        {
          name: "password",
          label: "Senha",
          placeholder: "Insira sua senha aqui",
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
    />
  );
}
