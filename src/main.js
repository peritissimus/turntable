import "./scene.js";
import "./ui.js";

const dialkitMount = document.getElementById("dialkitMount");
if (dialkitMount) {
  import("./components/DialKitPanel.jsx")
    .then(({ mountDialKitPanel }) => mountDialKitPanel(dialkitMount))
    .catch((error) => console.error("DialKit controls failed to load.", error));
}
