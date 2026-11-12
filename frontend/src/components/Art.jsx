// Clay-style 3D objects (generated with Higgsfield, public/art). Decorative only: always aria-hidden.
import React from "react";

const BASE = (process.env.PUBLIC_URL || "") + "/art/";

/** name: coins | bank | card | clock | folder | clipboard | magnifier | gears | badges | cubes */
export function Art({ name, className = "", size }) {
  return <img className={"li-art " + className} src={BASE + name + ".webp"} alt="" aria-hidden="true" width={size} height={size} decoding="async" />;
}
