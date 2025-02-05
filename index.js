import * as fs from "fs"; // Import the file system module
import * as OBC from "@thatopen/components"; // Import the That Open Company components package
import * as crypto from "crypto";
import { ifcRevitTypeMapping, ifcClassMapping, ifcRevitExportMapping } from "./mappings.js"; // Import mapping objects

const components = new OBC.Components(); // Create a new instance of the Components class
const ids = components.get(OBC.IDSSpecifications); // Get an instance of the IDSSpecifications component

const convertIdsParameters = () => {
  // Initialize arrays to store shared parameter and property set information. These will hold the data extracted from the IDS file and transformed into Revit-compatible formats.
  const parameters = [];
  const sets = [];

  // Iterate through all specifications in the IDS component. Each specification represents a set of requirements defined in the IDS file.
  for (const [, spec] of ids.list) {

    // Iterate through each requirement to extract property information.
    for (const req of spec.requirements) {
      // Skip requirements that are not properties. We are only concerned with requirements that define properties.
      if (req.facetType !== "Property") continue;

      // Extract data type and base name from the requirement.
      const { dataType, baseName } = req;

      // Map the IFC data type to a Revit data type.
      const revitType = ifcRevitTypeMapping[dataType];

      // Skip if the base name type is not simple, or there is no Revit type mapping. A simple base name allows direct extraction of the property name, and a Revit type mapping is necessary for compatibility.
      if (baseName.type !== "simple" || !revitType) continue;

      // Extract the property name.
      const { parameter: propName } = baseName;

      // Skip if a property with the same name already exists. This prevents duplicate properties in the shared parameters file.
      const existingProp = parameters.find(({ name }) => name === propName);
      if (existingProp) continue;

      // Create a shared parameter object. This object represents a parameter definition for the Revit shared parameters file.
      const sharedParameter = {
        param: "PARAM",
        guid: crypto.randomUUID(),
        name: propName,
        dataType: revitType,
        dataCategory: "",
        group: 1,
        visible: 1,
        description: "",
        userModifiable: 1,
        hideWhenNoValue: 0,
      }
      parameters.push(sharedParameter); // Add the shared parameter to the list.
    }

    // Initialize an array to store the IFC classes for each specification.
    const elements = [];

    // Iterate through the applicability section to determine which IFC classes the properties apply to.
    for (const app of spec.applicability) {
      // Skip applicability entries that are not entities. We are only interested in entities, since those are the IFC classes.
      if (app.facetType !== "Entity") continue;

      // Extract the name (entity data) from the applicability entry.
      const { name: entityData } = app;

      // Skip if the entity name type is not simple. A simple entity name allows direct extraction of the IFC class name.
      if (entityData.type !== "simple") continue;

      // Map the IFC class name to a Revit class name.
      const entity = ifcClassMapping[entityData.parameter];

      // Skip if there is no mapping. If we don't know how to map it to a revit class, we simply skip it.
      if (!entity) continue;

      elements.push(entity); // Add the Revit class name to the list of elements.
    }

    // Skip the specification if there are no elements. There is no point in creating configurations for properties that are not assigned to any element.
    if (elements.length === 0) continue;

    // Iterate through the requirements again to create the IFC export configuration.
    for (const req of spec.requirements) {
      // Check if the requirement is of type property.
      if (req.facetType !== "Property") continue;

      // Extract data type, property set, and base name.
      const { dataType, propertySet, baseName } = req;

      // Map the IFC data type to a Revit export type.
      const exportType = ifcRevitExportMapping[dataType];

      // Ensure the propertySet and baseName types are simple and a corresponding export type is found, else skip this iteration. We want direct name extraction and a corresponding type.
      if (propertySet.type !== "simple" || baseName.type !== "simple" || !exportType) continue;

      // Extract the property set name and property name.
      const { parameter: psetName } = propertySet;
      const { parameter: propName } = baseName;

      // Find an existing property set with the same name.
      let set = sets.find(({ name }) => name === psetName);

      // If the set doesn't exist, create one.
      if (!set) {
        set = { name: psetName, elements, props: [] }; //Create a set containing its name, the element which it applies to and an empty list to store properties
        sets.push(set); // Push the set to the set list
      }

      // Create a property.
      const prop = { // Create a property using the relevant names and types.
        nameInIfc: propName,
        type: exportType,
        revitName: propName,
      }
      set.props.push(prop); // Push the property to the set of properties
    }
  }

  // Initialize an array to store lines for the shared parameters file.
  const sharedParamsLines = [];

  // Iterate through parameters to create lines for the shared parameters file.
  for (const param of parameters) {
    const values = Object.values(param); // Get the values from the parameter object.
    sharedParamsLines.push(values.join("\\t")); // Join the values with a tab character and add the line to the sharedParamsLines array.
  }

  // Define the text content for the shared parameters file.
  const sharedParamsText = `# This is a Revit shared parameter file.
# Do not edit manually.
*META	VERSION	MINVERSION
META	2	1
*GROUP	ID	NAME
GROUP	1	IFC Parameters
*PARAM	GUID	NAME	DATATYPE	DATACATEGORY	GROUP	VISIBLE	DESCRIPTION	USERMODIFIABLE	HIDEWHENNOVALUE
${sharedParamsLines.join("\\n")}`;

  // Check if the shared parameters file already exists and delete it if it does.
  const sharedParamsFileExists = fs.existsSync("./SharedParameters.txt");
  if (sharedParamsFileExists) fs.rmSync("./SharedParameters.txt");

  // Write the shared parameters text to the file.
  fs.writeFileSync("./SharedParameters.txt", sharedParamsText);

  // Initialize an array to store lines for the property set file.
  const psetLines = [];

  // Iterate through sets to create lines for the property set file.
  for (const set of sets) {
    const { name, elements, props } = set; // Extract the name, elements, and properties from the set object.
    const psetLine = `PropertySet:\\t${name}\\tI\\t${elements.join(",")}`; // Create the property set line with the name and elements.
    const propLines = []; // Initialize an array to store the lines of text for the properties in the current set.

    // Iterate through the properties in the current set to create the lines of text for the properties.
    for (const prop of props) {
      const { revitName, type, nameInIfc } = prop; // Extract the Revit name, type, and IFC name from the property object.
      let propLine = `\\t${nameInIfc}\\t${type}`; // Create the property line with the IFC name and type.
      if (revitName) propLine += `\\t${revitName}`; // If a Revit name is specified, add it to the property line.
      propLines.push(propLine); // Add the property line to the propLines array.
    }
    const line = `${psetLine}\\n${propLines.join("\\n")}`; // Combine the property set line and the property lines.
    psetLines.push(line); // Add the line to the psetLines array.
  }

  // Join the property set lines with a newline character.
  const userDefinedPsetsText = psetLines.join("\\n");

  // Check if the property sets file already exists and delete it if it does.
  const psetsFileExists = fs.existsSync("./UserDefinedPsets.txt");
  if (psetsFileExists) fs.rmSync("./UserDefinedPsets.txt");

  // Write the user defined property sets text to the file.
  fs.writeFileSync("./UserDefinedPsets.txt", userDefinedPsetsText);

}

// Read the contents of the IDS file.
const requirements = fs.readFileSync("./requirements.ids", "utf8");

// Load the IDS content into the IDS component.
ids.load(requirements);

// Call the function to convert the IDS parameters.
convertIdsParameters()

