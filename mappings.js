// *Common Revit Exporting Types
// Text
// Integer
// Real
// Length
// Volume
// Boolean
export const ifcRevitExportMapping = {
  IFCDURATION: "Real",
  IFCBOOLEAN: "Boolean",
  IFCLABEL: "Text",
}

export const ifcClassMapping = {
  IFCWALL: "IfcWall",
  IFCCOLUMN: "IfcColumn"
}

// *Common Revit Data Types
// TEXT
// INTEGER
// ANGLE
// AREA
// DISTANCE
// LENGTH
// MASS_DENSITY
// NUMBER
// SLOPE
// VOLUME
// URL
// YESNO
export const ifcRevitTypeMapping = {
  IFCDURATION: "NUMBER",
  IFCBOOLEAN: "YESNO",
  IFCLABEL: "TEXT"
}