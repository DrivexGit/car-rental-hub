# No reflection in the app: JSON is read as a tree (kotlinx.serialization JsonElement), not into generated classes,
# so the default Android rules and the libraries' own rules are enough. Keep line numbers for readable crash reports.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
