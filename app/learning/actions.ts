"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LearningActionState } from "@/lib/learning";
import { createClient } from "@/lib/supabase/server";

const MAX_FILES = 12;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function pdfFiles(formData: FormData) {
  return formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

async function filesAreValidPdfs(files: File[]) {
  for (const file of files) {
    const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (new TextDecoder().decode(signature) !== "%PDF-") return false;
  }
  return true;
}

async function validateFiles(files: File[]) {
  if (files.length > MAX_FILES) {
    return `Attach no more than ${MAX_FILES} PDF files at once.`;
  }
  if (files.some((file) => file.size > MAX_FILE_SIZE)) {
    return "Each PDF must be 50 MB or smaller.";
  }
  if (files.some((file) => [...file.name].length > 255)) {
    return "Each PDF file name must be 255 characters or fewer.";
  }
  if (!(await filesAreValidPdfs(files))) {
    return "Attach PDF files only. One or more selected files is not a PDF.";
  }
  return null;
}

function validateLearningFields({
  title,
  notes,
  currentLesson,
  progressValue,
}: {
  title: string;
  notes: string;
  currentLesson?: string;
  progressValue?: string;
}) {
  const fieldErrors: NonNullable<LearningActionState["fieldErrors"]> = {};

  if ([...title].length < 1 || [...title].length > 200) {
    fieldErrors.title = "Enter a title between 1 and 200 characters.";
  }
  if ([...notes].length > 10000) {
    fieldErrors.notes = "Keep notes to 10,000 characters or fewer.";
  }
  if (currentLesson && [...currentLesson].length > 200) {
    fieldErrors.currentLesson =
      "Keep the current lesson to 200 characters or fewer.";
  }

  let progress: number | undefined;
  if (progressValue !== undefined) {
    if (!/^\d{1,3}$/.test(progressValue)) {
      fieldErrors.progress = "Enter progress from 0 to 100.";
    } else {
      progress = Number(progressValue);
      if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
        fieldErrors.progress = "Enter progress from 0 to 100.";
      }
    }
  }

  return { fieldErrors, progress };
}

async function uploadPdfs({
  files,
  itemId,
  userId,
}: {
  files: File[];
  itemId: string;
  userId: string;
}) {
  const supabase = await createClient();
  const uploaded: Array<{
    learning_item_id: string;
    user_id: string;
    file_name: string;
    storage_path: string;
    file_size: number;
    mime_type: string;
  }> = [];

  for (const file of files) {
    const path = `${userId}/${itemId}/${crypto.randomUUID()}.pdf`;
    const { error } = await supabase.storage
      .from("learning-materials")
      .upload(path, file, { contentType: "application/pdf", upsert: false });

    if (error) {
      if (uploaded.length > 0) {
        await supabase.storage
          .from("learning-materials")
          .remove(uploaded.map((material) => material.storage_path));
      }
      return { materials: [], error: true } as const;
    }

    uploaded.push({
      learning_item_id: itemId,
      user_id: userId,
      file_name: file.name,
      storage_path: path,
      file_size: file.size,
      mime_type: "application/pdf",
    });
  }

  return { materials: uploaded, error: false } as const;
}

export async function createLearningItem(
  _previousState: LearningActionState,
  formData: FormData,
): Promise<LearningActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const title = textValue(formData, "title");
  const notes = textValue(formData, "notes");
  const currentLesson = textValue(formData, "currentLesson");
  const files = pdfFiles(formData);
  const { fieldErrors } = validateLearningFields({
    title,
    notes,
    currentLesson,
  });
  const fileError = await validateFiles(files);
  if (fileError) fieldErrors.files = fileError;

  if (Object.keys(fieldErrors).length > 0) {
    return { message: "Check the highlighted fields and try again.", fieldErrors };
  }

  const itemId = crypto.randomUUID();
  const upload = await uploadPdfs({ files, itemId, userId: user.id });

  if (upload.error) {
    return {
      message: "We couldn’t upload your PDFs. Your learning item wasn’t created. Try again.",
      fieldErrors: { files: "Choose the PDFs again before retrying." },
    };
  }

  const { error: itemError } = await supabase.from("learning_items").insert({
    id: itemId,
    user_id: user.id,
    title,
    notes: notes || null,
    current_lesson: currentLesson || null,
    origin: "manual",
  });

  if (itemError) {
    if (upload.materials.length > 0) {
      await supabase.storage
        .from("learning-materials")
        .remove(upload.materials.map((material) => material.storage_path));
    }
    return {
      message: "We couldn’t create this learning item. Your entries are still here—try again.",
    };
  }

  if (upload.materials.length > 0) {
    const { error: materialsError } = await supabase
      .from("learning_materials")
      .insert(upload.materials);

    if (materialsError) {
      await supabase.from("learning_items").delete().eq("id", itemId);
      await supabase.storage
        .from("learning-materials")
        .remove(upload.materials.map((material) => material.storage_path));
      return {
        message: "We couldn’t attach your PDFs, so the learning item wasn’t created. Try again.",
        fieldErrors: { files: "Choose the PDFs again before retrying." },
      };
    }
  }

  revalidatePath("/dashboard");
  redirect(`/learning/${itemId}`);
}

export async function updateLearningItem(
  _previousState: LearningActionState,
  formData: FormData,
): Promise<LearningActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const itemId = textValue(formData, "itemId");
  if (!UUID_PATTERN.test(itemId)) {
    return { message: "We couldn’t identify this learning item. Return to the dashboard and try again." };
  }

  const title = textValue(formData, "title");
  const notes = textValue(formData, "notes");
  const currentLesson = textValue(formData, "currentLesson");
  const progressValue = textValue(formData, "progress");
  const { fieldErrors, progress } = validateLearningFields({
    title,
    notes,
    currentLesson,
    progressValue,
  });

  if (Object.keys(fieldErrors).length > 0 || progress === undefined) {
    return { message: "Check the highlighted fields and try again.", fieldErrors };
  }

  const { data, error } = await supabase
    .from("learning_items")
    .update({
      title,
      notes: notes || null,
      current_lesson: currentLesson || null,
      progress,
      last_studied_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      message: "We couldn’t save these changes. Your entries are still here—try again.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/learning/${itemId}`);
  redirect(`/learning/${itemId}?updated=1`);
}

export async function attachLearningMaterials(
  _previousState: LearningActionState,
  formData: FormData,
): Promise<LearningActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const itemId = textValue(formData, "itemId");
  const files = pdfFiles(formData);
  if (!UUID_PATTERN.test(itemId)) {
    return { message: "We couldn’t identify this learning item. Return to the dashboard and try again." };
  }
  if (files.length === 0) {
    return {
      message: "Choose at least one PDF to attach.",
      fieldErrors: { files: "Choose one or more PDF files." },
    };
  }

  const fileError = await validateFiles(files);
  if (fileError) return { message: fileError, fieldErrors: { files: fileError } };

  const [{ data: item }, { count, error: countError }] = await Promise.all([
    supabase
      .from("learning_items")
      .select("id")
      .eq("id", itemId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("learning_materials")
      .select("id", { count: "exact", head: true })
      .eq("learning_item_id", itemId)
      .eq("user_id", user.id),
  ]);

  if (!item || countError) {
    return { message: "We couldn’t load this learning item. Return to the dashboard and try again." };
  }
  if ((count ?? 0) + files.length > MAX_FILES) {
    const available = Math.max(0, MAX_FILES - (count ?? 0));
    return {
      message:
        available === 0
          ? `This learning item already has the maximum of ${MAX_FILES} PDFs.`
          : `You can attach ${available} more ${available === 1 ? "PDF" : "PDFs"} to this learning item.`,
      fieldErrors: { files: "Choose fewer PDF files." },
    };
  }

  const upload = await uploadPdfs({ files, itemId, userId: user.id });
  if (upload.error) {
    return {
      message: "We couldn’t upload your PDFs. Choose them again and retry.",
      fieldErrors: { files: "Choose the PDFs again before retrying." },
    };
  }

  const { error } = await supabase.from("learning_materials").insert(upload.materials);
  if (error) {
    await supabase.storage
      .from("learning-materials")
      .remove(upload.materials.map((material) => material.storage_path));
    return {
      message: "We couldn’t attach your PDFs. Choose them again and retry.",
      fieldErrors: { files: "Choose the PDFs again before retrying." },
    };
  }

  revalidatePath(`/learning/${itemId}`);
  redirect(`/learning/${itemId}?materials=added`);
}
