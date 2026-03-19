const actionButton = document.getElementById("actionButton");
const statusText = document.getElementById("statusText");

actionButton.addEventListener("click", () => {
  const now = new Date();
  const time = now.toLocaleTimeString("no-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  statusText.textContent = `Takk! Vi tar kontakt med deg. Registrert kl. ${time}.`;
});
